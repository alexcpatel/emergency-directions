/**
 * Formatting utility functions
 */

import { DISTANCE_THRESHOLDS, ROUTE_CONFIG_PROCESSING } from '../config';

/**
 * Format distance in meters to miles
 */
export function formatDistance(meters: number): string {
  const miles = meters / DISTANCE_THRESHOLDS.metersPerMile;
  return `${miles.toFixed(1)} mi`;
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Calculate walking duration from distance
 */
export function calculateWalkingDuration(distanceMeters: number): number {
  return distanceMeters / ROUTE_CONFIG_PROCESSING.walkingSpeedMps;
}

/**
 * Calculate days needed for a given walking duration
 */
export function calculateDaysNeeded(durationSeconds: number): number {
  const hours = durationSeconds / 3600;
  return Math.ceil(hours / ROUTE_CONFIG_PROCESSING.walkingHoursPerDay);
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}
