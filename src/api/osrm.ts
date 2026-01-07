/**
 * OSRM (Open Source Routing Machine) API client
 */

import axios from 'axios';
import { API_ENDPOINTS, API_CONFIG, ROUTE_CONFIG_PROCESSING } from '../config';
import { Location, OSRMRoute, OSRMResponse, RouteStep } from '../types';

/**
 * Fetch walking route from OSRM
 */
export async function fetchWalkingRoute(
  start: Location,
  end: Location
): Promise<OSRMRoute> {
  const url = buildRouteUrl(API_ENDPOINTS.osrmFoot, start, end);

  console.log('Fetching walking route from OSRM (foot profile)...');

  try {
    const response = await axios.get<OSRMResponse>(url, {
      timeout: API_CONFIG.requestTimeoutMs,
    });

    if (response.data.code === 'Ok') {
      const route = response.data.routes[0];
      return adjustRouteDuration(route);
    }
  } catch (error) {
    console.log('  OSRM foot profile failed, trying fallback...');
  }

  // Fallback to driving profile with adjusted duration
  return fetchFallbackRoute(start, end);
}

async function fetchFallbackRoute(start: Location, end: Location): Promise<OSRMRoute> {
  const url = buildRouteUrl(API_ENDPOINTS.osrmFallback, start, end);

  console.log('  Using driving route as base, will adjust for walking...');

  const response = await axios.get<OSRMResponse>(url, {
    timeout: API_CONFIG.requestTimeoutMs,
  });

  if (response.data.code !== 'Ok') {
    throw new Error(`OSRM error: ${response.data.code}`);
  }

  const route = response.data.routes[0];
  // Recalculate duration for walking speed
  route.duration = route.distance / ROUTE_CONFIG_PROCESSING.walkingSpeedMps;

  return route;
}

function buildRouteUrl(baseUrl: string, start: Location, end: Location): string {
  const coords = `${start.lon},${start.lat};${end.lon},${end.lat}`;
  return `${baseUrl}/${coords}?overview=full&geometries=geojson&steps=true`;
}

/**
 * Adjust route duration to realistic walking speed if needed
 */
function adjustRouteDuration(route: OSRMRoute): OSRMRoute {
  const expectedDuration = route.distance / ROUTE_CONFIG_PROCESSING.walkingSpeedMps;

  // If API duration is unrealistically short, use calculated walking time
  if (route.duration < expectedDuration * 0.5) {
    console.log('  Adjusting duration to realistic walking speed...');
    route.duration = expectedDuration;
  }

  return route;
}

/**
 * Extract navigation steps from OSRM route
 */
export function extractSteps(route: OSRMRoute): RouteStep[] {
  const steps: RouteStep[] = [];

  for (const leg of route.legs) {
    for (const step of leg.steps) {
      if (step.maneuver && step.name) {
        steps.push({
          instruction: step.maneuver.type,
          modifier: step.maneuver.modifier,
          name: step.name || 'unnamed road',
          distance: step.distance,
          duration: step.duration,
          location: step.maneuver.location,
        });
      }
    }
  }

  return steps;
}
