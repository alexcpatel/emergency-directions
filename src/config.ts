/**
 * Configuration constants for the emergency directions generator
 */

import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Get required environment variable or throw error
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}. Please copy .env.example to .env and fill in your values.`);
  }
  return value;
}

/**
 * Get numeric environment variable
 */
function requireNumericEnv(key: string): number {
  const value = requireEnv(key);
  const num = parseFloat(value);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${value}`);
  }
  return num;
}

// Route endpoints (loaded from environment)
export const ROUTE_CONFIG = {
  start: {
    lat: requireNumericEnv('START_LAT'),
    lon: requireNumericEnv('START_LON'),
    name: requireEnv('START_NAME'),
    address: requireEnv('START_ADDRESS'),
  },
  end: {
    lat: requireNumericEnv('END_LAT'),
    lon: requireNumericEnv('END_LON'),
    name: requireEnv('END_NAME'),
    address: requireEnv('END_ADDRESS'),
  },
};

// API endpoints
export const API_ENDPOINTS = {
  osrmFoot: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  osrmFallback: 'https://router.project-osrm.org/route/v1/driving',
  nominatim: 'https://nominatim.openstreetmap.org/reverse',
} as const;

// API configuration
export const API_CONFIG = {
  /** Delay between Nominatim requests to respect rate limits (ms) */
  nominatimDelayMs: 1100,
  /** Request timeout (ms) */
  requestTimeoutMs: 30000,
  /** User agent for API requests */
  userAgent: 'EmergencyDirectionsGenerator/1.0',
  /** Nominatim zoom level for detailed addresses */
  nominatimZoom: 18,
  /** Maximum concurrent Nominatim requests */
  maxConcurrentRequests: 1,
} as const;

// Route processing
export const ROUTE_CONFIG_PROCESSING = {
  /**
   * Segment mode: 'distance' or 'count'
   * - 'distance': segments are created based on milesPerSegment
   * - 'count': route is divided into numSegments equal parts
   */
  segmentMode: (process.env.SEGMENT_MODE || 'distance') as 'distance' | 'count',
  /** Miles per segment (when mode is 'distance') */
  milesPerSegment: parseFloat(process.env.MILES_PER_SEGMENT || '1'),
  /** Number of segments (when mode is 'count') */
  numSegments: parseInt(process.env.NUM_SEGMENTS || '10', 10),
  /** Minimum steps per segment */
  minStepsPerSegment: 2,
  /** Maximum steps per segment (only enforced in 'count' mode) */
  maxStepsPerSegment: 20,
  /** Average walking speed in meters per second (3 mph) */
  walkingSpeedMps: 1.34,
  /** Walking hours per day for planning */
  walkingHoursPerDay: 8,
  /** Number of waypoint samples per segment */
  waypointsPerSegment: 2,
};

// Distance thresholds (in meters)
export const DISTANCE_THRESHOLDS = {
  /** Minimum distance to show a step */
  minStepDistance: 80,
  /** Minimum distance for waypoint inclusion */
  minWaypointDistance: 200,
  /** Minimum missing distance to show "continue" message */
  minMissingDistance: 500,
  /** Meters per mile conversion */
  metersPerMile: 1609.34,
} as const;

// Map rendering
export const MAP_CONFIG = {
  /** Overview map dimensions */
  overview: { width: 700, height: 180 },
  /** Segment map dimensions - compact square */
  segment: { width: 120, height: 120 },
  /** Bounds padding factor */
  boundsPadding: 0.35,
  /** Max points to sample for SVG paths */
  maxOverviewPoints: 200,
  maxSegmentPoints: 100,
  /** CartoDB Voyager - clean design with POIs, not too cluttered */
  tileServerUrl: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  /** Overview map tile server - no labels for cleaner look */
  overviewTileServerUrl: 'https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png',
  /** Tile size in pixels */
  tileSize: 256,
} as const;

// Highway terms to flag in directions
export const HIGHWAY_TERMS = [
  'expressway',
  'thruway',
  'parkway',
  'interstate',
  'i-',
  'highway',
  'turnpike',
] as const;

// Output configuration
export const OUTPUT_CONFIG = {
  directory: 'output',
  filename: 'emergency-directions.html',
} as const;
