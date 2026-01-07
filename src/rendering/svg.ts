/**
 * SVG map rendering with OpenStreetMap tile backgrounds
 * Maintains proper geographic aspect ratio (north up, no stretching)
 */

import { RouteSegment, Bounds, MapDimensions } from '../types';
import { MAP_CONFIG } from '../config';
import { calculateBounds, sampleCoordinates } from '../utils/geo';

/**
 * Adjust bounds to maintain proper aspect ratio for the viewport
 * This prevents map stretching and keeps north up
 */
function adjustBoundsForAspectRatio(
  bounds: Bounds,
  viewportWidth: number,
  viewportHeight: number
): Bounds {
  const latRange = bounds.maxLat - bounds.minLat;
  const lonRange = bounds.maxLon - bounds.minLon;

  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const centerLon = (bounds.minLon + bounds.maxLon) / 2;

  // Latitude correction factor
  const latCorrection = Math.cos((centerLat * Math.PI) / 180);
  const adjustedLonRange = lonRange * latCorrection;

  const viewportAspect = viewportWidth / viewportHeight;
  const geoAspect = adjustedLonRange / latRange;

  let newLatRange = latRange;
  let newLonRange = lonRange;

  if (geoAspect > viewportAspect) {
    newLatRange = adjustedLonRange / viewportAspect;
  } else {
    newLonRange = (latRange * viewportAspect) / latCorrection;
  }

  return {
    minLat: centerLat - newLatRange / 2,
    maxLat: centerLat + newLatRange / 2,
    minLon: centerLon - newLonRange / 2,
    maxLon: centerLon + newLonRange / 2,
    centerLat,
    centerLon,
  };
}

/**
 * Generate SVG map for a route segment - clean, minimal
 */
export function generateSegmentMapSvg(
  segment: RouteSegment,
  dimensions: MapDimensions = MAP_CONFIG.segment
): string {
  const { width, height } = dimensions;
  const { coordinates, startCoord, endCoord } = segment;

  const rawBounds = segment.bounds;
  const bounds = adjustBoundsForAspectRatio(rawBounds, width, height);

  const sampledCoords = sampleCoordinates(coordinates, MAP_CONFIG.maxSegmentPoints);
  const pathD = generateSvgPath(sampledCoords, bounds, width, height);

  const startX = toSvgX(startCoord[0], bounds, width);
  const startY = toSvgY(startCoord[1], bounds, height);
  const endX = toSvgX(endCoord[0], bounds, width);
  const endY = toSvgY(endCoord[1], bounds, height);

  const tileImages = generateTileImages(bounds, width, height);

  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice" class="segment-map-svg">
      <defs>
        <clipPath id="mapClip-${segment.index}">
          <rect width="${width}" height="${height}"/>
        </clipPath>
      </defs>
      <rect width="${width}" height="${height}" fill="#e8e8e8" stroke="#999"/>
      <g clip-path="url(#mapClip-${segment.index})">${tileImages}</g>
      <path d="${pathD}" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <path d="${pathD}" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <circle cx="${startX}" cy="${startY}" r="5" fill="#fff" stroke="#000" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
      <circle cx="${endX}" cy="${endY}" r="5" fill="#000" stroke="#fff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
    </svg>`;
}

/**
 * Generate SVG overview map for entire route
 */
export function generateOverviewMapSvg(
  coordinates: Array<[number, number]>,
  dimensions: MapDimensions = MAP_CONFIG.overview
): string {
  const { width, height } = dimensions;

  const rawBounds = calculateBounds(coordinates);
  const bounds = adjustBoundsForAspectRatio(rawBounds, width, height);

  const sampledCoords = sampleCoordinates(coordinates, MAP_CONFIG.maxOverviewPoints);
  const pathD = generateSvgPath(sampledCoords, bounds, width, height);

  const startX = toSvgX(coordinates[0][0], bounds, width);
  const startY = toSvgY(coordinates[0][1], bounds, height);
  const endCoord = coordinates[coordinates.length - 1];
  const endX = toSvgX(endCoord[0], bounds, width);
  const endY = toSvgY(endCoord[1], bounds, height);

  const tileImages = generateTileImages(bounds, width, height);

  return `<svg viewBox="0 0 ${width} ${height}" class="overview-map-svg">
      <defs>
        <clipPath id="overviewClip">
          <rect width="${width}" height="${height}"/>
        </clipPath>
      </defs>
      <rect width="${width}" height="${height}" fill="#e8e8e8" stroke="#999"/>
      <g clip-path="url(#overviewClip)">${tileImages}</g>
      <path d="${pathD}" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${pathD}" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${startX}" cy="${startY}" r="7" fill="#fff" stroke="#000" stroke-width="2"/>
      <text x="${startX + 10}" y="${startY + 4}" font-size="9" font-weight="bold" fill="#000">START</text>
      <circle cx="${endX}" cy="${endY}" r="7" fill="#000" stroke="#fff" stroke-width="2"/>
      <text x="${endX + 10}" y="${endY + 4}" font-size="9" font-weight="bold" fill="#000">END</text>
    </svg>`;
}

/**
 * Generate tile image elements for the map background
 */
function generateTileImages(bounds: Bounds, width: number, height: number): string {
  const zoom = calculateZoomLevel(bounds, width, height);
  const tiles = getTilesForBounds(bounds, zoom);

  const images: string[] = [];

  for (const tile of tiles) {
    const tileUrl = MAP_CONFIG.tileServerUrl
      .replace('{z}', zoom.toString())
      .replace('{x}', tile.x.toString())
      .replace('{y}', tile.y.toString());

    const tileBounds = getTileBounds(tile.x, tile.y, zoom);

    const tileLeft = toSvgX(tileBounds.minLon, bounds, width);
    const tileTop = toSvgY(tileBounds.maxLat, bounds, height);
    const tileRight = toSvgX(tileBounds.maxLon, bounds, width);
    const tileBottom = toSvgY(tileBounds.minLat, bounds, height);

    const tileWidth = tileRight - tileLeft;
    const tileHeight = tileBottom - tileTop;

    images.push(
      `<image href="${tileUrl}" x="${tileLeft}" y="${tileTop}" width="${tileWidth}" height="${tileHeight}" preserveAspectRatio="none"/>`
    );
  }

  return images.join('');
}

/**
 * Calculate appropriate zoom level for bounds
 */
function calculateZoomLevel(bounds: Bounds, width: number, height: number): number {
  const latRange = bounds.maxLat - bounds.minLat;
  const lonRange = bounds.maxLon - bounds.minLon;

  const degreesPerPixelLon = lonRange / width;
  const degreesPerPixelLat = latRange / height;
  const degreesPerPixel = Math.max(degreesPerPixelLon, degreesPerPixelLat);

  const idealZoom = Math.log2(360 / (256 * degreesPerPixel));

  return Math.max(12, Math.min(16, Math.ceil(idealZoom + 1)));
}

/**
 * Get all tiles needed to cover the bounds
 */
function getTilesForBounds(bounds: Bounds, zoom: number): Array<{ x: number; y: number }> {
  const minTile = latLonToTile(bounds.maxLat, bounds.minLon, zoom);
  const maxTile = latLonToTile(bounds.minLat, bounds.maxLon, zoom);

  const tiles: Array<{ x: number; y: number }> = [];

  for (let x = minTile.x; x <= maxTile.x; x++) {
    for (let y = minTile.y; y <= maxTile.y; y++) {
      tiles.push({ x, y });
    }
  }

  return tiles;
}

/**
 * Convert lat/lon to tile coordinates
 */
function latLonToTile(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

/**
 * Get the bounds of a tile in lat/lon
 */
function getTileBounds(x: number, y: number, zoom: number): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const n = Math.pow(2, zoom);

  const minLon = (x / n) * 360 - 180;
  const maxLon = ((x + 1) / n) * 360 - 180;

  const minLatRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));
  const maxLatRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));

  const minLat = (minLatRad * 180) / Math.PI;
  const maxLat = (maxLatRad * 180) / Math.PI;

  return { minLat, maxLat, minLon, maxLon };
}

function generateSvgPath(coordinates: Array<[number, number]>, bounds: Bounds, width: number, height: number): string {
  return coordinates
    .map(([lon, lat], i) => {
      const x = toSvgX(lon, bounds, width).toFixed(1);
      const y = toSvgY(lat, bounds, height).toFixed(1);
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
}

function toSvgX(lon: number, bounds: Bounds, width: number): number {
  const lonRange = bounds.maxLon - bounds.minLon;
  return ((lon - bounds.minLon) / lonRange) * width;
}

function toSvgY(lat: number, bounds: Bounds, height: number): number {
  const latRange = bounds.maxLat - bounds.minLat;
  return height - ((lat - bounds.minLat) / latRange) * height;
}
