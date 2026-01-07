/**
 * Geographic utility functions
 */

import { Bounds } from '../types';
import { MAP_CONFIG } from '../config';

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculate distance between two points using Haversine formula
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate total distance of a coordinate path
 */
export function calculatePathDistance(coordinates: Array<[number, number]>): number {
  let total = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const [lon1, lat1] = coordinates[i - 1];
    const [lon2, lat2] = coordinates[i];
    total += haversineDistance(lat1, lon1, lat2, lon2);
  }

  return total;
}

/**
 * Calculate bounding box for a set of coordinates
 */
export function calculateBounds(coordinates: Array<[number, number]>): Bounds {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const [lon, lat] of coordinates) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }

  // Add padding
  const latPad = (maxLat - minLat) * MAP_CONFIG.boundsPadding;
  const lonPad = (maxLon - minLon) * MAP_CONFIG.boundsPadding;

  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLon: minLon - lonPad,
    maxLon: maxLon + lonPad,
    centerLat: (minLat + maxLat) / 2,
    centerLon: (minLon + maxLon) / 2,
  };
}

/**
 * Calculate Euclidean distance between two points (for quick comparisons)
 */
export function euclideanDistance(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): number {
  return Math.sqrt(Math.pow(lon1 - lon2, 2) + Math.pow(lat1 - lat2, 2));
}

/**
 * Check if a point is within bounds
 */
export function isPointInBounds(lon: number, lat: number, bounds: Bounds): boolean {
  return (
    lon >= bounds.minLon &&
    lon <= bounds.maxLon &&
    lat >= bounds.minLat &&
    lat <= bounds.maxLat
  );
}

/**
 * Sample points from a coordinate array at regular intervals
 */
export function sampleCoordinates(
  coordinates: Array<[number, number]>,
  maxPoints: number
): Array<[number, number]> {
  if (coordinates.length <= maxPoints) {
    return coordinates;
  }

  const step = Math.max(1, Math.floor(coordinates.length / maxPoints));
  return coordinates.filter((_, i) => i % step === 0);
}
