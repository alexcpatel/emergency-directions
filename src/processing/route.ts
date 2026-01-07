/**
 * Route processing and segmentation
 */

import { OSRMRoute, RouteSegment, Bounds } from '../types';
import { ROUTE_CONFIG_PROCESSING } from '../config';
import { calculateBounds, calculatePathDistance } from '../utils/geo';
import { calculateWalkingDuration } from '../utils/format';

/**
 * Divide route into segments for easier navigation
 */
export function segmentRoute(
  route: OSRMRoute,
  numSegments: number = ROUTE_CONFIG_PROCESSING.numSegments
): RouteSegment[] {
  const coordinates = route.geometry.coordinates;
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
