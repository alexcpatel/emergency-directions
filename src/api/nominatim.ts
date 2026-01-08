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
 * Batches requests in parallel for speed
 */
export async function fetchSegmentLocations(
  segments: RouteSegment[]
): Promise<SegmentLocation[]> {
  console.log('Fetching location names for segments...');

  if (segments.length === 0) return [];

  // Collect all unique coordinates we need to fetch
  // We need: segment 1 start, and all segment ends
  const coordsToFetch: Array<{ lat: number; lon: number; type: 'start' | 'end'; segmentIndex: number }> = [];

  // First segment's start
  coordsToFetch.push({
    lat: segments[0].startCoord[1],
    lon: segments[0].startCoord[0],
    type: 'start',
    segmentIndex: 0,
  });

  // All segment ends
  segments.forEach((seg, idx) => {
    coordsToFetch.push({
      lat: seg.endCoord[1],
      lon: seg.endCoord[0],
      type: 'end',
      segmentIndex: idx,
    });
  });

  // Batch fetch all coordinates in parallel (with concurrency limit)
  const batchSize = 5; // Process 5 requests at a time
  const results: Map<string, NominatimResponse | null> = new Map();
  const totalBatches = Math.ceil(coordsToFetch.length / batchSize);

  for (let i = 0; i < coordsToFetch.length; i += batchSize) {
    const batch = coordsToFetch.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    console.log(`  Fetching batch ${batchNum}/${totalBatches} (${batch.length} locations)...`);

    const batchPromises = batch.map(async (coord) => {
      const key = `${coord.lat},${coord.lon}`;
      if (!results.has(key)) {
        const data = await fetchPlaceName(coord.lat, coord.lon);
        results.set(key, data);
      }
      return { coord, data: results.get(key)! };
    });

    await Promise.all(batchPromises);
  }

  // Build locations array using fetched data and log as we build
  const locations: SegmentLocation[] = [];
  let lastEndName: string | null = null;
  let lastEndAddr: NominatimAddress | undefined = undefined;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // Start name: use previous segment's end name, or fetch fresh for first segment
    let startName: string;
    let startAddr: NominatimAddress | undefined;

    if (lastEndName !== null) {
      startName = lastEndName;
      startAddr = lastEndAddr;
    } else {
      const startKey = `${seg.startCoord[1]},${seg.startCoord[0]}`;
      const startData = results.get(startKey) || null;
      startName = extractLocationName(startData);
      startAddr = startData?.address;
    }

    // Get end name from fetched data
    const endKey = `${seg.endCoord[1]},${seg.endCoord[0]}`;
    const endData = results.get(endKey) || null;
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

    // Log as we complete each segment
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
