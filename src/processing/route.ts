/**
 * Route processing and segmentation
 */

import { OSRMRoute, RouteSegment, RouteStep, Bounds } from '../types';
import { ROUTE_CONFIG_PROCESSING } from '../config';
import { calculateBounds, calculatePathDistance } from '../utils/geo';
import { calculateWalkingDuration } from '../utils/format';

/**
 * Divide route into segments based on number of steps per segment
 * Each segment's distance is the sum of its steps' distances
 */
export function segmentRoute(
  route: OSRMRoute,
  steps?: RouteStep[]
): RouteSegment[] {
  if (!steps || steps.length === 0) {
    // Fallback: create a single segment from route coordinates
    const coordinates = route.geometry.coordinates;
    const bounds = calculateBounds(coordinates);
    const distance = calculatePathDistance(coordinates);
    return [{
      index: 1,
      coordinates,
      startCoord: coordinates[0],
      endCoord: coordinates[coordinates.length - 1],
      bounds,
      distance,
      duration: calculateWalkingDuration(distance),
    }];
  }

  const { stepsPerSegment } = ROUTE_CONFIG_PROCESSING;
  return segmentBySteps(steps, stepsPerSegment);
}

/**
 * Segment by grouping steps together
 * Each segment's distance is the sum of its steps' distances
 * Segment coordinates are derived from the steps' geometries
 */
function segmentBySteps(
  steps: RouteStep[],
  stepsPerSegment: number
): RouteSegment[] {
  const segments: RouteSegment[] = [];
  let stepIdx = 0;
  let segmentIndex = 1;

  while (stepIdx < steps.length) {
    // Calculate how many steps go in this segment
    const remainingSteps = steps.length - stepIdx;
    const segStepCount = Math.min(stepsPerSegment, remainingSteps);
    const startStepIdx = stepIdx;
    const endStepIdx = stepIdx + segStepCount - 1;

    // Get the steps for this segment
    const segmentSteps = steps.slice(startStepIdx, endStepIdx + 1);

    // Calculate segment distance from sum of step distances
    const distance = segmentSteps.reduce((sum, step) => sum + step.distance, 0);
    const duration = calculateWalkingDuration(distance);

    // Build coordinates from step geometries
    const coordinates: Array<[number, number]> = [];
    for (const step of segmentSteps) {
      if (step.geometry && step.geometry.length > 0) {
        // Add all coordinates from this step's geometry
        for (const coord of step.geometry) {
          coordinates.push(coord);
        }
      } else {
        // Fallback: use step location
        coordinates.push(step.location);
      }
    }

    // Remove duplicate consecutive coordinates
    const uniqueCoords: Array<[number, number]> = [];
    for (let j = 0; j < coordinates.length; j++) {
      if (j === 0 || coordinates[j][0] !== coordinates[j - 1][0] || coordinates[j][1] !== coordinates[j - 1][1]) {
        uniqueCoords.push(coordinates[j]);
      }
    }

    // Ensure we have at least start and end coordinates
    if (uniqueCoords.length === 0) {
      uniqueCoords.push(segmentSteps[0].location);
      if (segmentSteps.length > 1) {
        uniqueCoords.push(segmentSteps[segmentSteps.length - 1].location);
      }
    }

    const bounds = calculateBounds(uniqueCoords);
    const stepRange: [number, number] = [startStepIdx, endStepIdx];
    const stepIndices: number[] = [];
    for (let j = startStepIdx; j <= endStepIdx; j++) {
      stepIndices.push(j);
    }

    segments.push({
      index: segmentIndex,
      coordinates: uniqueCoords,
      startCoord: uniqueCoords[0],
      endCoord: uniqueCoords[uniqueCoords.length - 1],
      bounds,
      distance, // This is now the sum of step distances
      duration,
      stepRange,
      stepIndices,
    });

    stepIdx += segStepCount;
    segmentIndex++;
  }

  return segments;
}

