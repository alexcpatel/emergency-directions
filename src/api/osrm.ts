/**
 * OSRM API client - simplified
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { Location, OSRMRoute, RouteStep } from '../types';

const OSRM_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const WALKING_SPEED_MPS = 1.34; // ~3 mph

/**
 * Fetch route from OSRM
 */
export async function fetchRoute(start: Location, end: Location): Promise<OSRMRoute> {
  const coords = `${start.lon},${start.lat};${end.lon},${end.lat}`;
  // Request all available metadata: steps, annotations, and banners
  const url = `${OSRM_URL}/${coords}?overview=full&geometries=geojson&steps=true&annotations=true`;

  console.log('Fetching route from OSRM...');

  const response = await axios.get(url, { timeout: 30000 });

  if (response.data.code !== 'Ok') {
    throw new Error(`OSRM error: ${response.data.code}`);
  }

  // Save raw API response for inspection
  const outputDir = path.join(__dirname, '..', '..', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const rawResponsePath = path.join(outputDir, 'osrm-raw-response.json');
  fs.writeFileSync(rawResponsePath, JSON.stringify(response.data, null, 2));
  console.log(`Raw OSRM API response saved to: ${rawResponsePath}`);

  const route = response.data.routes[0];

  // Adjust duration for walking speed
  route.duration = route.distance / WALKING_SPEED_MPS;

  return route;
}

/**
 * Extract steps directly from OSRM response
 */
export function extractSteps(route: OSRMRoute): RouteStep[] {
  const steps: RouteStep[] = [];

  // Log first step structure to see all available fields
  if (route.legs && route.legs[0] && route.legs[0].steps && route.legs[0].steps[0]) {
    const firstStep = route.legs[0].steps[0];
    console.log('\nFirst step from OSRM - available fields:');
    console.log(JSON.stringify(Object.keys(firstStep), null, 2));
    if (firstStep.maneuver) {
      console.log('Maneuver fields:', JSON.stringify(Object.keys(firstStep.maneuver), null, 2));
    }
    console.log('Sample step data:', JSON.stringify(firstStep, null, 2));
  }

  for (const leg of route.legs) {
    for (const step of leg.steps) {
      if (step.maneuver) {
        steps.push({
          instruction: step.maneuver.type,
          modifier: step.maneuver.modifier,
          name: step.name || '',
          ref: step.ref,
          distance: step.distance,
          duration: step.distance / WALKING_SPEED_MPS,
          location: step.maneuver.location,
        });
      }
    }
  }

  return steps;
}
