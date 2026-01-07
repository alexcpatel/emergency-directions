/**
 * OSRM API client - simplified
 */

import axios from 'axios';
import { Location, OSRMRoute, RouteStep } from '../types';

const OSRM_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';
const WALKING_SPEED_MPS = 1.34; // ~3 mph

/**
 * Fetch route from OSRM
 */
export async function fetchRoute(start: Location, end: Location): Promise<OSRMRoute> {
  const coords = `${start.lon},${start.lat};${end.lon},${end.lat}`;
  const url = `${OSRM_URL}/${coords}?overview=full&geometries=geojson&steps=true`;

  console.log('Fetching route from OSRM...');

  const response = await axios.get(url, { timeout: 30000 });

  if (response.data.code !== 'Ok') {
    throw new Error(`OSRM error: ${response.data.code}`);
  }

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

  for (const leg of route.legs) {
    for (const step of leg.steps) {
      if (step.maneuver) {
        steps.push({
          instruction: step.maneuver.type,
          modifier: step.maneuver.modifier,
          name: step.name || '',
          distance: step.distance,
          duration: step.distance / WALKING_SPEED_MPS,
          location: step.maneuver.location,
        });
      }
    }
  }

  return steps;
}
