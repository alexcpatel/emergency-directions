/**
 * Route processing and segmentation
 */

import { OSRMRoute, RouteSegment, RouteStep, Bounds } from '../types';
import { ROUTE_CONFIG_PROCESSING } from '../config';
import { calculateBounds, calculatePathDistance } from '../utils/geo';
import { calculateWalkingDuration } from '../utils/format';

/**
 * Divide route into segments based on OSRM steps (not coordinates)
 * This ensures steps are evenly distributed across segments
 */
export function segmentRoute(
  route: OSRMRoute,
  numSegments: number = ROUTE_CONFIG_PROCESSING.numSegments,
  steps?: RouteStep[]
): RouteSegment[] {
  const coordinates = route.geometry.coordinates;

  // If no steps provided, fall back to coordinate-based segmentation
  if (!steps || steps.length === 0) {
    return segmentByCoordinates(coordinates, numSegments);
  }

  // Segment by steps: distribute steps evenly across segments
  const stepsPerSegment = Math.floor(steps.length / numSegments);
  const extraSteps = steps.length % numSegments;
  const segments: RouteSegment[] = [];

  let stepIdx = 0;
  for (let i = 0; i < numSegments; i++) {
    // Give some segments an extra step to distribute evenly
    const segmentStepCount = stepsPerSegment + (i < extraSteps ? 1 : 0);
    const startStepIdx = stepIdx;
    const endStepIdx = stepIdx + segmentStepCount - 1;
    stepIdx += segmentStepCount;

    if (startStepIdx >= steps.length) break;

    // Get coordinate range for this segment's steps
    const startStep = steps[startStepIdx];
    const endStep = steps[endStepIdx];

    // Find coordinate indices closest to step locations
    const startCoordIdx = findClosestCoordinate(coordinates, startStep.location);
    const endCoordIdx = findClosestCoordinate(coordinates, endStep.location);

    // Ensure we have at least some coordinates
    const segmentCoords = coordinates.slice(
      Math.min(startCoordIdx, endCoordIdx),
      Math.max(startCoordIdx, endCoordIdx) + 1
    );

    if (segmentCoords.length < 2) continue;

    const bounds = calculateBounds(segmentCoords);
    const distance = calculatePathDistance(segmentCoords);
    const duration = calculateWalkingDuration(distance);

    segments.push({
      index: segments.length + 1,
      coordinates: segmentCoords,
      startCoord: segmentCoords[0],
      endCoord: segmentCoords[segmentCoords.length - 1],
      bounds,
      distance,
      duration,
      stepRange: [startStepIdx, endStepIdx],
    });
  }

  return segments;
}

/**
 * Find the coordinate index closest to a given location
 */
function findClosestCoordinate(
  coordinates: Array<[number, number]>,
  location: [number, number]
): number {
  let bestIdx = 0;
  let bestDist = Infinity;

  for (let i = 0; i < coordinates.length; i++) {
    const [lon, lat] = coordinates[i];
    const dist = Math.pow(lon - location[0], 2) + Math.pow(lat - location[1], 2);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  return bestIdx;
}

/**
 * Fallback: segment by coordinate count
 */
function segmentByCoordinates(
  coordinates: Array<[number, number]>,
  numSegments: number
): RouteSegment[] {
  const totalPoints = coordinates.length;
  const pointsPerSegment = Math.floor(totalPoints / numSegments);
  const segments: RouteSegment[] = [];

  for (let i = 0; i < numSegments; i++) {
    const startIdx = i * pointsPerSegment;
    const endIdx = i === numSegments - 1 ? totalPoints - 1 : (i + 1) * pointsPerSegment;

    const segmentCoords = coordinates.slice(startIdx, endIdx + 1);
    const bounds = calculateBounds(segmentCoords);
    const distance = calculatePathDistance(segmentCoords);
    const duration = calculateWalkingDuration(distance);

    segments.push({
      index: i + 1,
      coordinates: segmentCoords,
      startCoord: segmentCoords[0],
      endCoord: segmentCoords[segmentCoords.length - 1],
      bounds,
      distance,
      duration,
    });
  }

  return segments;
}

/**
 * Find which segment a coordinate belongs to
 */
export function findSegmentForCoordinate(
  lon: number,
  lat: number,
  segments: RouteSegment[]
): number {
  let bestSegment = 0;
  let bestScore = Infinity;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // Calculate distance to segment endpoints
    const startDist = Math.sqrt(
      Math.pow(lon - seg.startCoord[0], 2) + Math.pow(lat - seg.startCoord[1], 2)
    );
    const endDist = Math.sqrt(
      Math.pow(lon - seg.endCoord[0], 2) + Math.pow(lat - seg.endCoord[1], 2)
    );

    // Check if point is within segment bounds
    const inBounds =
      lon >= seg.bounds.minLon &&
      lon <= seg.bounds.maxLon &&
      lat >= seg.bounds.minLat &&
      lat <= seg.bounds.maxLat;

    // Score based on distance, with bonus for being in bounds
    const minDist = Math.min(startDist, endDist);
    const score = inBounds ? minDist * 0.5 : minDist;

    if (score < bestScore) {
      bestScore = score;
      bestSegment = i;
    }
  }

  return bestSegment;
}
