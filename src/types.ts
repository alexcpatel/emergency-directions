/**
 * TypeScript interfaces for the emergency directions generator
 */

// Geographic types
export interface Coordinate {
  lat: number;
  lon: number;
}

export interface Location extends Coordinate {
  name: string;
  address: string;
}

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  centerLat: number;
  centerLon: number;
}

// OSRM API types
export interface OSRMManeuver {
  type: string;
  modifier?: string;
  location: [number, number]; // [lon, lat]
}

export interface OSRMStep {
  maneuver: OSRMManeuver;
  name: string;
  distance: number;
  duration: number;
}

export interface OSRMLeg {
  steps: OSRMStep[];
}

export interface OSRMRoute {
  distance: number;
  duration: number;
  geometry: {
    coordinates: Array<[number, number]>; // [lon, lat][]
  };
  legs: OSRMLeg[];
}

export interface OSRMResponse {
  code: string;
  routes: OSRMRoute[];
}

// Nominatim API types
export interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  city_district?: string;
  borough?: string;
  city?: string;
  municipality?: string;
}

export interface NominatimResponse {
  address?: NominatimAddress;
}

// Processed route types
export interface RouteStep {
  instruction: string;
  modifier?: string;
  name: string;
  distance: number;
  duration: number;
  location: [number, number];
}

export interface Waypoint {
  road: string;
  distance: number;
}

export interface RouteSegment {
  index: number;
  coordinates: Array<[number, number]>;
  startCoord: [number, number];
  endCoord: [number, number];
  bounds: Bounds;
  distance: number;
  duration: number;
  waypoints?: Waypoint[];
  stepRange?: [number, number]; // [startStepIdx, endStepIdx]
}

export interface SegmentLocation {
  startName: string;
  endName: string;
  startAddr?: NominatimAddress;
  endAddr?: NominatimAddress;
}

// Rendering types
export interface ProcessedStep {
  instruction: string;
  modifier?: string | null;
  name: string;
  distance: number;
  aggregated?: boolean;
}

export interface MapDimensions {
  width: number;
  height: number;
}
