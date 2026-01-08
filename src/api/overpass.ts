/**
 * Overpass API client for querying OpenStreetMap POIs and ways
 */

import axios from 'axios';
import { Bounds } from '../types';

// Use a mirror that's often less loaded
const OVERPASS_API = 'https://overpass.kumi.systems/api/interpreter';

export interface POI {
  id: number;
  lat: number;
  lon: number;
  name: string;
  type: string;
  iconType: string;
  priority: number;
}

// POI types with survival priority (lower number = higher priority)
const POI_TYPES: Record<string, { label: string; iconType: string; priority: number }> = {
  'hospital': { label: 'Hospital', iconType: 'hospital', priority: 1 }, // Highest - medical emergency
  'fire_station': { label: 'Fire Station', iconType: 'fire-station', priority: 2 }, // Emergency services
  'police': { label: 'Police', iconType: 'police', priority: 3 }, // Emergency services
  'place_of_worship': { label: 'Church', iconType: 'church', priority: 4 }, // Shelter
  'fuel': { label: 'Gas', iconType: 'gas', priority: 5 }, // Supplies
  'school': { label: 'School', iconType: 'school', priority: 6 }, // Landmark/shelter
};

/**
 * Query Overpass API for POIs within bounds
 */
export async function fetchPOIsInBounds(bounds: Bounds, segmentNum?: number): Promise<POI[]> {
  const bbox = `${bounds.minLat},${bounds.minLon},${bounds.maxLat},${bounds.maxLon}`;

  // Query for amenities with names - fetch more so we have enough after filtering
  const query = `[out:json][timeout:5];
(
  node["amenity"~"hospital|fire_station|police|place_of_worship|fuel|school"]["name"](${bbox});
);
out body 20;`;

  try {
    const response = await axios.post(OVERPASS_API, `data=${encodeURIComponent(query)}`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });

    const elements = response.data.elements || [];

    // Log what we received
    const amenityTypes: string[] = elements.map((el: any) => el.tags?.amenity).filter(Boolean);
    const uniqueTypes = [...new Set(amenityTypes)];

    // Check for unhandled types
    const unhandled = uniqueTypes.filter((t) => !POI_TYPES[t]);
    if (unhandled.length > 0 && segmentNum !== undefined) {
      console.log(`    Segment ${segmentNum}: unhandled amenity types: ${unhandled.join(', ')}`);
    }

    const pois = elements
      .filter((el: any) => el.tags?.name && POI_TYPES[el.tags.amenity])
      .map((el: any) => {
        const poiType = POI_TYPES[el.tags.amenity];
        return {
          id: el.id,
          lat: el.lat,
          lon: el.lon,
          name: el.tags.name,
          type: poiType.label,
          iconType: poiType.iconType,
          priority: poiType.priority,
        };
      })
      .sort((a: POI, b: POI) => a.priority - b.priority); // Sort by priority (lower = more important)

    // Return up to 10 so SVG renderer can pick best 3 after overlap filtering
    return pois.slice(0, 10);
  } catch (error) {
    console.error('  Overpass API error:', (error as Error).message);
    return [];
  }
}

/**
 * Fetch POIs for all segments with batching and rate limiting
 */
export async function fetchPOIsForSegments(
  segmentBounds: Bounds[]
): Promise<POI[][]> {
  console.log('Fetching POIs for segments...');

  const allPOIs: POI[][] = [];
  const batchSize = 3; // Process 3 segments at a time to respect rate limits
  const totalBatches = Math.ceil(segmentBounds.length / batchSize);

  for (let i = 0; i < segmentBounds.length; i += batchSize) {
    const batch = segmentBounds.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    console.log(`  Fetching batch ${batchNum}/${totalBatches} (${batch.length} segments)...`);

    // Fetch POIs for this batch in parallel
    const batchPromises = batch.map(async (bounds, batchIdx) => {
      const segmentIdx = i + batchIdx;
      console.log(`    Segment ${segmentIdx + 1}: fetching POIs...`);
      const pois = await fetchPOIsInBounds(bounds, segmentIdx + 1);
      console.log(`    Segment ${segmentIdx + 1}: ${pois.length} POIs found`);
      return pois;
    });

    const batchResults = await Promise.all(batchPromises);
    allPOIs.push(...batchResults);

    // Rate limit between batches - 1 second delay
    if (i + batchSize < segmentBounds.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return allPOIs;
}

