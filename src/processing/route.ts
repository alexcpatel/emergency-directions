/**
 * Route processing and segmentation
 */

import { OSRMRoute, RouteSegment, RouteStep, Bounds } from '../types';
import { ROUTE_CONFIG_PROCESSING } from '../config';
import { calculateBounds, calculatePathDistance } from '../utils/geo';
import { calculateWalkingDuration } from '../utils/format';

/**
 * Divide route into segments based on config settings
 * Supports both distance-based and count-based segmentation
 */
export function segmentRoute(
  route: OSRMRoute,
  _unused?: number, // Kept for backwards compatibility
  steps?: RouteStep[]
): RouteSegment[] {
  const coordinates = route.geometry.coordinates;
  const { segmentMode, milesPerSegment, numSegments } = ROUTE_CONFIG_PROCESSING;

  // Convert miles to meters
  const targetDistance = milesPerSegment * 1609.34;

  // Count mode: divide into fixed number of segments
  if (segmentMode === 'count') {
    return segmentByCoordinates(coordinates, numSegments, steps);
  }

  // Distance mode: walk through coordinates and cut at target distance
  return segmentByDistance(coordinates, targetDistance, steps);
}

/**
 * Segment route by walking through coordinates and cutting at target distance
 * Ensures segments are continuous (end of N = start of N+1)
 */
function segmentByDistance(
  coordinates: Array<[number, number]>,
  targetDistance: number,
  steps?: RouteStep[]
): RouteSegment[] {
  // First, map each step to its closest coordinate index
  const stepToCoordIndex: Map<number, number> = new Map();
  if (steps) {
    for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
      const step = steps[stepIdx];
      const coordIdx = findClosestCoordinate(coordinates, step.location);
      stepToCoordIndex.set(stepIdx, coordIdx);
    }
  }

  const segments: RouteSegment[] = [];
  let segmentStartIdx = 0;
  let accumulatedDistance = 0;

  for (let i = 1; i < coordinates.length; i++) {
    // Calculate distance from previous point
    const [lon1, lat1] = coordinates[i - 1];
    const [lon2, lat2] = coordinates[i];
    const segDist = haversineDistance(lat1, lon1, lat2, lon2);
    accumulatedDistance += segDist;

    // Check if we should end this segment
    const isLastPoint = i === coordinates.length - 1;
    const reachedTarget = accumulatedDistance >= targetDistance;

    if (isLastPoint || reachedTarget) {
      const segmentCoords = coordinates.slice(segmentStartIdx, i + 1);

      if (segmentCoords.length >= 2) {
        const bounds = calculateBounds(segmentCoords);
        const distance = calculatePathDistance(segmentCoords);
        const duration = calculateWalkingDuration(distance);

        // Find step range: steps whose coordinate indices fall within this segment
        let stepRange: [number, number] | undefined;
        if (steps && stepToCoordIndex.size > 0) {
          const segmentStartCoordIdx = segmentStartIdx;
          const segmentEndCoordIdx = i;

          let firstStepIdx: number | null = null;
          let lastStepIdx: number | null = null;

          for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
            const coordIdx = stepToCoordIndex.get(stepIdx);
            if (coordIdx === undefined) continue;

            // Step is in this segment if its coordinate index is within bounds
            if (coordIdx >= segmentStartCoordIdx && coordIdx <= segmentEndCoordIdx) {
              if (firstStepIdx === null) firstStepIdx = stepIdx;
              lastStepIdx = stepIdx;
            }
          }

          if (firstStepIdx !== null && lastStepIdx !== null) {
            stepRange = [firstStepIdx, lastStepIdx];
          }
        }

        segments.push({
          index: segments.length + 1,
          coordinates: segmentCoords,
          startCoord: segmentCoords[0],
          endCoord: segmentCoords[segmentCoords.length - 1],
          bounds,
          distance,
          duration,
          stepRange,
        });
      }

      // Start next segment from current point (ensures continuity)
      segmentStartIdx = i;
      accumulatedDistance = 0;
    }
  }

  return segments;
}

/**
 * Haversine distance between two points in meters
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
 * Segment by coordinate count (with optional step assignment)
 */
function segmentByCoordinates(
  coordinates: Array<[number, number]>,
  numSegments: number,
  steps?: RouteStep[]
): RouteSegment[] {
  const totalPoints = coordinates.length;
  const pointsPerSegment = Math.floor(totalPoints / numSegments);
  const segments: RouteSegment[] = [];

  // If we have steps, distribute them evenly across segments
  const stepsPerSegment = steps ? Math.floor(steps.length / numSegments) : 0;
  const extraSteps = steps ? steps.length % numSegments : 0;
  let stepIdx = 0;

  for (let i = 0; i < numSegments; i++) {
    const startIdx = i * pointsPerSegment;
    const endIdx = i === numSegments - 1 ? totalPoints - 1 : (i + 1) * pointsPerSegment;

    const segmentCoords = coordinates.slice(startIdx, endIdx + 1);
    const bounds = calculateBounds(segmentCoords);
    const distance = calculatePathDistance(segmentCoords);
    const duration = calculateWalkingDuration(distance);

    // Calculate step range for this segment
    let stepRange: [number, number] | undefined;
    if (steps && steps.length > 0) {
      const segStepCount = stepsPerSegment + (i < extraSteps ? 1 : 0);
      const startStepIdx = stepIdx;
      const endStepIdx = Math.min(stepIdx + segStepCount - 1, steps.length - 1);
      stepRange = [startStepIdx, endStepIdx];
      stepIdx += segStepCount;
    }

    segments.push({
      index: i + 1,
      coordinates: segmentCoords,
      startCoord: segmentCoords[0],
      endCoord: segmentCoords[segmentCoords.length - 1],
      bounds,
      stepRange,
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
