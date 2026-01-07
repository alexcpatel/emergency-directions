/**
 * HTML document generation
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  OSRMRoute,
  RouteSegment,
  SegmentLocation,
  RouteStep,
  Waypoint,
} from '../types';
import { ROUTE_CONFIG, DISTANCE_THRESHOLDS } from '../config';
import {
  formatDistance,
  formatDuration,
  calculateDaysNeeded,
} from '../utils/format';
import { generateOverviewMapSvg, generateSegmentMapSvg } from './svg';
import {
  processStepsForDisplay,
  filterStepsForDisplay,
  formatStepInstruction,
} from '../processing/steps';

/**
 * Load CSS from templates directory
 */
function loadStyles(): string {
  const cssPath = path.join(__dirname, '../../templates/styles.css');
  return fs.readFileSync(cssPath, 'utf-8');
}

/**
 * Generate complete HTML document
 */
export function generateHtmlDocument(
  route: OSRMRoute,
  segments: RouteSegment[],
  segmentLocations: SegmentLocation[],
  segmentSteps: RouteStep[][]
): string {
  const styles = loadStyles();
  const totalDistance = formatDistance(route.distance);
  const walkingHours = route.distance / (1.34 * 3600);
  const totalDuration = `${Math.round(walkingHours)} hours`;
  const daysNeeded = calculateDaysNeeded(route.duration);

  const coordinates = route.geometry.coordinates;
  const overviewSvg = generateOverviewMapSvg(coordinates);
  const segmentsHtml = generateSegmentsHtml(segments, segmentLocations, segmentSteps);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Emergency Walking Directions</title>
  <style>
${styles}
  </style>
</head>
<body>
  <header>
    <h1>Emergency Walking Route</h1>
  </header>

  <div class="route-info">
    <div class="endpoint">
      <div class="label">From</div>
      <div class="name">${ROUTE_CONFIG.start.name}</div>
      <div class="addr">${ROUTE_CONFIG.start.address}</div>
    </div>
    <div class="arrow">→</div>
    <div class="endpoint">
      <div class="label">To</div>
      <div class="name">${ROUTE_CONFIG.end.name}</div>
      <div class="addr">${ROUTE_CONFIG.end.address}</div>
    </div>
    <div class="totals">
      <div class="big">${totalDistance}</div>
      <div>~${totalDuration} walking</div>
      <div>Plan ${daysNeeded}+ days</div>
    </div>
  </div>

  <div class="warning">
    <strong>⚠ Emergency Use:</strong> Walk facing traffic. Carry water. Rest when needed. This route follows roads—some lack sidewalks. At night, stay visible or shelter in place.
  </div>

  <div class="overview">
    <h2>Full Route Overview</h2>
    ${overviewSvg}
  </div>

${segmentsHtml}

  <div class="survival">
    <h3>Survival Essentials</h3>
    <ul>
      <li><strong>WATER:</strong> Gas stations, fast food restrooms, public buildings, fire stations. Streams/rivers: filter or boil if possible.</li>
      <li><strong>FOOD:</strong> Convenience stores, gas stations, supermarkets along route. Carry high-calorie bars.</li>
      <li><strong>SHELTER (night):</strong> Churches (often unlocked), fire station lobbies, hospital waiting areas, 24hr businesses (McDonald's, Walmart), highway rest areas, dense woods away from road.</li>
      <li><strong>REST POINTS:</strong> Parks, cemeteries (quiet, benches), shopping plaza benches, bus shelters.</li>
      <li><strong>DANGER:</strong> Stay off highway travel lanes. Walk facing traffic. At night: stop or stay in lit areas.</li>
      <li><strong>INJURY/EMERGENCY:</strong> Call 911. Flag any vehicle. Seek buildings with lights. Fire stations are staffed 24/7.</li>
    </ul>
  </div>

  <div class="emergency-box">
    <div class="item">
      <div class="label">Emergency</div>
      <div class="value">911</div>
    </div>
    <div class="item">
      <div class="label">NY State Police</div>
      <div class="value">(914) 769-2600</div>
    </div>
    <div class="item">
      <div class="label">CT State Police</div>
      <div class="value">(860) 355-3133</div>
    </div>
  </div>

  <footer>
    Route generated from OpenStreetMap data via OSRM · Location names via Nominatim · For emergency use
  </footer>
</body>
</html>`;
}

function generateSegmentsHtml(
  segments: RouteSegment[],
  segmentLocations: SegmentLocation[],
  segmentSteps: RouteStep[][]
): string {
  return segments
    .map((seg, i) => generateSegmentHtml(seg, segmentLocations[i], segmentSteps[i]))
    .join('\n');
}

function generateSegmentHtml(
  segment: RouteSegment,
  location: SegmentLocation,
  steps: RouteStep[]
): string {
  const segDistance = formatDistance(segment.distance);
  const segDuration = formatDuration(segment.duration);
  const mapSvg = generateSegmentMapSvg(segment);
  const stepsHtml = generateStepsHtml(segment, steps);

  return `
      <div class="segment">
        <div class="segment-header">
          <span class="segment-num">${segment.index}</span>
          <div class="segment-title">
            <strong>${location.startName} → ${location.endName}</strong>
            <span class="segment-stats">${segDistance} · ~${segDuration}</span>
          </div>
        </div>
        <div class="segment-body">
          <div class="segment-map">${mapSvg}</div>
          <div class="segment-directions">
            <ul>${stepsHtml}</ul>
          </div>
        </div>
      </div>
    `;
}

function generateStepsHtml(segment: RouteSegment, steps: RouteStep[]): string {
  const processedSteps = processStepsForDisplay(steps);
  const displaySteps = filterStepsForDisplay(processedSteps);

  // Calculate displayed distance
  const displayedDistance = displaySteps.reduce((sum, s) => sum + (s.distance || 0), 0);
  const missingDistance = segment.distance - displayedDistance;

  let html = displaySteps.map((s) => `<li>${formatStepInstruction(s)}</li>`).join('\n');

  // Add waypoints for missing distance
  if (missingDistance > DISTANCE_THRESHOLDS.minMissingDistance && segment.waypoints?.length) {
    for (const wp of segment.waypoints) {
      html += `\n<li>Continue on <strong>${wp.road}</strong> — ${formatDistance(wp.distance)}</li>`;
    }
  } else if (missingDistance > DISTANCE_THRESHOLDS.minMissingDistance) {
    html += `\n<li>Continue on route — ${formatDistance(missingDistance)} (follow map)</li>`;
  }

  if (!html) {
    html = '<li>Follow the route shown on map</li>';
  }

  return html;
}
