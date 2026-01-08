/**
 * Nominatim (OpenStreetMap) reverse geocoding API client
 */

import axios from 'axios';
import { API_ENDPOINTS, API_CONFIG } from '../config';
import { NominatimResponse, NominatimAddress, RouteSegment, SegmentLocation, Waypoint, RouteStep } from '../types';
import { calculatePathDistance } from '../utils/geo';

// Request queue for rate limiting
let lastRequestTime = 0;

/**
 * Fetch place name from coordinates with rate limiting
 */
export async function fetchPlaceName(lat: number, lon: number): Promise<NominatimResponse | null> {
  await enforceRateLimit();

  const url = `${API_ENDPOINTS.nominatim}?lat=${lat}&lon=${lon}&format=json&zoom=${API_CONFIG.nominatimZoom}&addressdetails=1`;

  try {
    const response = await axios.get<NominatimResponse>(url, {
      headers: { 'User-Agent': API_CONFIG.userAgent },
      timeout: API_CONFIG.requestTimeoutMs,
    });
    return response.data;
  } catch (error) {
    console.error(`  Failed to fetch place name for ${lat},${lon}`);
    return null;
  }
}

async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < API_CONFIG.nominatimDelayMs) {
    await sleep(API_CONFIG.nominatimDelayMs - timeSinceLastRequest);
  }

  lastRequestTime = Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract best location name from Nominatim response
 */
export function extractLocationName(data: NominatimResponse | null): string {
  if (!data?.address) return 'Unknown';

  const addr = data.address;

  // Priority order for most specific name
  const candidates = [
    addr.neighbourhood,
    addr.suburb,
    addr.town,
    addr.village,
    addr.hamlet,
    addr.city_district,
    addr.borough,
    addr.city,
    addr.municipality,
  ].filter(Boolean);

  if (candidates.length === 0) return 'Unknown';

  let name = candidates[0]!;

  // If name is too generic, add road context
  const genericNames = ['City of New York', 'New York'];
  if (addr.road && (genericNames.includes(name) || !name)) {
    name = addr.neighbourhood ? `${addr.neighbourhood} (${addr.road})` : addr.road;
  }

  return name;
}

/**
 * Fetch location names for all segments
 * Chains names so end of segment N = start of segment N+1
 */
export async function fetchSegmentLocations(
  segments: RouteSegment[]
): Promise<SegmentLocation[]> {
  console.log('Fetching location names for segments...');

  const locations: SegmentLocation[] = [];

  // Track last end name/addr to chain segments together
  let lastEndName: string | null = null;
  let lastEndAddr: NominatimAddress | undefined = undefined;

  for (const seg of segments) {
    // Start name: use previous segment's end name, or fetch fresh for first segment
    let startName: string;
    let startAddr: NominatimAddress | undefined;

    if (lastEndName !== null) {
      startName = lastEndName;
      startAddr = lastEndAddr;
    } else {
      const startData = await fetchPlaceName(seg.startCoord[1], seg.startCoord[0]);
      startName = extractLocationName(startData);
      startAddr = startData?.address;
    }

    // Always fetch end name fresh
    const endData = await fetchPlaceName(seg.endCoord[1], seg.endCoord[0]);
    const endName = extractLocationName(endData);

    locations.push({
      startName,
      endName,
      startAddr,
      endAddr: endData?.address,
    });

    // Save for next segment
    lastEndName = endName;
    lastEndAddr = endData?.address;

    console.log(`  Segment ${seg.index}: ${startName} → ${endName}`);
  }

  return locations;
}

async function fetchSegmentEndpoints(
  seg: RouteSegment
): Promise<[NominatimResponse | null, NominatimResponse | null]> {
  const startData = await fetchPlaceName(seg.startCoord[1], seg.startCoord[0]);
  const endData = await fetchPlaceName(seg.endCoord[1], seg.endCoord[0]);
  return [startData, endData];
}

/**
 * Fetch intermediate waypoints for segments
 * Uses sampling to reduce API calls while covering the route
 */
export async function fetchSegmentWaypoints(
  segments: RouteSegment[],
  samplesPerSegment: number
): Promise<void> {
  console.log('Fetching intermediate waypoints for segments...');

  for (const seg of segments) {
    const waypoints = await extractWaypointsForSegment(seg, samplesPerSegment);
    seg.waypoints = waypoints;
    console.log(`  Segment ${seg.index}: ${waypoints.length} waypoints`);
  }
}

async function extractWaypointsForSegment(
  seg: RouteSegment,
  numSamples: number
): Promise<Waypoint[]> {
  const waypoints: Waypoint[] = [];
  const coords = seg.coordinates;
  const step = Math.floor(coords.length / (numSamples + 1));

  let lastRoad = '';
  let lastRoadStartIdx = 0;

  for (let i = step; i < coords.length - step; i += step) {
    const [lon, lat] = coords[i];
    const data = await fetchPlaceName(lat, lon);

    if (data?.address?.road) {
      const road = data.address.road;

      if (road !== lastRoad && lastRoad) {
        const distCoords = coords.slice(lastRoadStartIdx, i);
        const distance = calculatePathDistance(distCoords);

        if (distance > 200) {
          waypoints.push({ road: lastRoad, distance });
        }
      }

      if (road !== lastRoad) {
        lastRoad = road;
        lastRoadStartIdx = i;
      }
    }
  }

  // Add final stretch
  if (lastRoad && lastRoadStartIdx < coords.length - 1) {
    const distCoords = coords.slice(lastRoadStartIdx);
    const distance = calculatePathDistance(distCoords);

    if (distance > 200) {
      waypoints.push({ road: lastRoad, distance });
    }
  }

  return waypoints;
}
