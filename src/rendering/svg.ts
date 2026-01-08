/**
 * SVG map rendering with OpenStreetMap tile backgrounds
 * Maintains proper geographic aspect ratio (north up, no stretching)
 */

import { RouteSegment, Bounds, MapDimensions } from '../types';
import { MAP_CONFIG } from '../config';
import { calculateBounds, sampleCoordinates } from '../utils/geo';
import { POI } from '../api/overpass';

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
  dimensions: MapDimensions = MAP_CONFIG.segment,
  pois: POI[] = []
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
  const poiMarkers = generatePOIMarkers(pois, bounds, width, height, segment.index, sampledCoords, startX, startY, endX, endY);

  return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice" class="segment-map-svg">
      <defs>
        <clipPath id="mapClip-${segment.index}">
          <rect width="${width}" height="${height}"/>
        </clipPath>
        <filter id="grayscale-${segment.index}">
          <feColorMatrix type="saturate" values="0"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="#e8e8e8" stroke="#999"/>
      <g clip-path="url(#mapClip-${segment.index})" filter="url(#grayscale-${segment.index})">${tileImages}</g>
      <path d="${pathD}" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <path d="${pathD}" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      ${poiMarkers}
      <circle cx="${startX}" cy="${startY}" r="5" fill="#fff" stroke="#000" stroke-width="1.5"/>
      <circle cx="${endX}" cy="${endY}" r="5" fill="#000" stroke="#fff" stroke-width="1.5"/>
    </svg>`;
}

// Lucide POI icons (24x24 viewBox) - actual Lucide paths
const POI_ICONS: Record<string, string> = {
  // Lucide 'cross' - medical cross
  'hospital': `<path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/>`,
  // Lucide 'flame'
  'fire-station': `<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>`,
  // Lucide 'shield'
  'police': `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>`,
  // Lucide 'church'
  'church': `<path d="m18 7 4 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9l4-2"/><path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"/><path d="M18 22V5l-6-3-6 3v17"/><path d="M12 7v5"/><path d="M10 9h4"/>`,
  // Lucide 'fuel'
  'gas': `<line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>`,
  // Lucide 'graduation-cap'
  'school': `<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>`,
};

/**
 * Calculate minimum distance from a point to any point on the route (in degrees, approximate)
 */
function minDistanceToRoute(
  poiLon: number,
  poiLat: number,
  routeCoords: Array<[number, number]>
): number {
  let minDist = Infinity;
  for (const [lon, lat] of routeCoords) {
    // Simple Euclidean distance in degrees (good enough for filtering)
    const dist = Math.sqrt(Math.pow(lon - poiLon, 2) + Math.pow(lat - poiLat, 2));
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

/**
 * Determine which side of the route a POI is on
 * Returns 'left' or 'right'
 */
function getPOISideOfRoute(
  poiX: number,
  poiY: number,
  routeCoords: Array<[number, number]>,
  bounds: Bounds,
  width: number,
  height: number
): 'left' | 'right' {
  // Find nearest route point in SVG coordinates
  let nearestRouteX = poiX;
  let minDist = Infinity;

  for (const coord of routeCoords) {
    // Handle both [lon, lat] and already-converted coordinates
    const [lon, lat] = coord;
    const routeX = toSvgX(lon, bounds, width);
    const routeY = toSvgY(lat, bounds, height);
    const dist = Math.sqrt(Math.pow(routeX - poiX, 2) + Math.pow(routeY - poiY, 2));
    if (dist < minDist) {
      minDist = dist;
      nearestRouteX = routeX;
    }
  }

  // If POI is to the left of route, place icon on left; otherwise on right
  return poiX < nearestRouteX ? 'left' : 'right';
}

/**
 * Generate POI markers for the map
 */
function generatePOIMarkers(
  pois: POI[],
  bounds: Bounds,
  width: number,
  height: number,
  segmentIndex: number,
  routeCoords: Array<[number, number]>,
  startX?: number,
  startY?: number,
  endX?: number,
  endY?: number
): string {
  if (pois.length === 0) return '';

  // Filter POIs to those close to the route (within ~0.005 degrees ≈ 500m)
  const MAX_DISTANCE = 0.005;
  const nearbyPois = pois.filter((poi) =>
    minDistanceToRoute(poi.lon, poi.lat, routeCoords) < MAX_DISTANCE
  );

  const markers: string[] = [];
  const usedLabelPositions: Array<{ x: number; y: number }> = [];
  const MAX_DISPLAYED = 3;
  const OFFSET = 14;
  const MARGIN = 20;

  // Convert route to SVG coords for collision
  const routeSvg = routeCoords.map(([lon, lat]) => ({
    x: toSvgX(lon, bounds, width),
    y: toSvgY(lat, bounds, height)
  }));

  // Check distance from point to route
  const distToRoute = (px: number, py: number): number => {
    let minDist = Infinity;
    for (let i = 0; i < routeSvg.length - 1; i++) {
      const a = routeSvg[i], b = routeSvg[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
      const dist = Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
      if (dist < minDist) minDist = dist;
    }
    return minDist;
  };

  // Check if position is valid for a label
  const isValid = (lx: number, ly: number): boolean => {
    // Must be inside margins
    if (lx < MARGIN || lx > width - MARGIN || ly < MARGIN || ly > height - MARGIN) return false;
    // Must be away from route
    if (distToRoute(lx, ly) < 10) return false;
    // Must be away from start/end
    if (startX !== undefined && startY !== undefined && Math.hypot(lx - startX, ly - startY) < 18) return false;
    if (endX !== undefined && endY !== undefined && Math.hypot(lx - endX, ly - endY) < 18) return false;
    // Must be away from other labels
    for (const p of usedLabelPositions) {
      if (Math.abs(lx - p.x) < 22 && Math.abs(ly - p.y) < 16) return false;
    }
    return true;
  };

  // Show up to 3 nearby POIs (already sorted by priority)
  // Never skip important POIs - always find a valid position for the label
  for (const poi of nearbyPois) {
    if (markers.length >= MAX_DISPLAYED) break;

    const x = toSvgX(poi.lon, bounds, width);
    const y = toSvgY(poi.lat, bounds, height);

    // Only skip if the POI dot itself is completely outside the map
    if (x < 0 || x > width || y < 0 || y > height) continue;

    // Clamp dot position if it's near edges (so line connects properly)
    const dotX = Math.max(2, Math.min(width - 2, x));
    const dotY = Math.max(2, Math.min(height - 2, y));

    // Determine preferred side (away from route)
    const side = getPOISideOfRoute(dotX, dotY, routeCoords, bounds, width, height);
    const dir = side === 'right' ? 1 : -1;

    // Try positions: close first, then further out, preferred side then opposite
    let labelX = dotX, labelY = dotY;
    let found = false;

    const offsets = [OFFSET, OFFSET + 8, OFFSET + 16];
    const yShifts = [0, -12, 12, -24, 24];

    outer: for (const off of offsets) {
      for (const yShift of yShifts) {
        // Try preferred side
        const x1 = dotX + dir * off;
        const y1 = dotY + yShift;
        if (isValid(x1, y1)) {
          labelX = x1; labelY = y1; found = true; break outer;
        }
        // Try opposite side
        const x2 = dotX - dir * off;
        if (isValid(x2, y1)) {
          labelX = x2; labelY = y1; found = true; break outer;
        }
      }
    }

    // Fallback: just place it somewhere visible
    if (!found) {
      labelX = Math.max(MARGIN, Math.min(width - MARGIN, dotX + dir * OFFSET));
      labelY = Math.max(MARGIN, Math.min(height - MARGIN, dotY));
    }

    usedLabelPositions.push({ x: labelX, y: labelY });

    // Truncate long names - show more characters
    const name = poi.name.length > 18 ? poi.name.substring(0, 16) + '…' : poi.name;
    const iconPath = POI_ICONS[poi.iconType] || POI_ICONS['hospital'];

    // Render Lucide icon at fixed size (6x6) - scale path from 24x24 viewBox
    const iconSize = 6;
    const pathScale = iconSize / 24;
    const iconCenterX = labelX;
    const iconCenterY = labelY;

    markers.push(`<g class="poi">
        <circle cx="${dotX}" cy="${dotY}" r="1.5" fill="#000"/>
        <line x1="${dotX}" y1="${dotY}" x2="${labelX}" y2="${labelY}" stroke="#000" stroke-width="0.3"/>
        <rect x="${labelX - 4}" y="${labelY - 4}" width="8" height="8" fill="#fff" stroke="#000" stroke-width="0.4" rx="1"/>
        <g transform="translate(${iconCenterX - iconSize / 2}, ${iconCenterY - iconSize / 2}) scale(${pathScale})">
          <g fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${iconPath}</g>
        </g>
        <text x="${labelX}" y="${labelY + 8}" font-size="2.5" fill="#000" font-family="sans-serif" text-anchor="middle">${escapeXml(name)}</text>
      </g>`);
  }

  return markers.join('\n      ');
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
        <filter id="grayscale-overview">
          <feColorMatrix type="saturate" values="0"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="#e8e8e8" stroke="#999"/>
      <g clip-path="url(#overviewClip)" filter="url(#grayscale-overview)">${tileImages}</g>
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
