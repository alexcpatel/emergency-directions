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
  ProcessedStep,
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
  getStepIconType,
} from '../processing/steps';

// SVG Icons for directions
const DIRECTION_ICONS: Record<string, string> = {
  'straight': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M12 5l-5 5M12 5l5 5"/></svg>`,
  'left': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M5 12l5-5M5 12l5 5"/></svg>`,
  'right': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M19 12l-5-5M19 12l-5 5"/></svg>`,
  'slight-left': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 17L7 7M7 7v6M7 7h6"/></svg>`,
  'slight-right': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17l10-10M17 7v6M17 7h-6"/></svg>`,
  'start': `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>`,
  'end': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`,
  'roundabout': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="6"/><path d="M12 6V2M12 22v-4"/></svg>`,
};

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
  const segmentsWrapped = `<div class="segments-container">${segmentsHtml}</div>`;

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
    <strong>⚠ Emergency Use:</strong> Walk facing traffic. Carry water. Rest when needed. At night, stay visible or shelter in place.
  </div>

  <div class="overview">
    <h2>Full Route Overview</h2>
    ${overviewSvg}
  </div>

${segmentsWrapped}

  <div class="survival">
    <div class="survival-item"><strong>Water</strong>Gas stations, fast food, fire stations</div>
    <div class="survival-item"><strong>Food</strong>Convenience stores, supermarkets</div>
    <div class="survival-item"><strong>Shelter</strong>Churches, fire stations, 24hr stores</div>
    <div class="survival-item"><strong>Emergency</strong>Call 911, flag vehicles, seek lit areas</div>
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

  let items = displaySteps.map((s) => formatStepWithIcon(s)).join('\n');

  // Add waypoints for missing distance
  if (missingDistance > DISTANCE_THRESHOLDS.minMissingDistance && segment.waypoints?.length) {
    for (const wp of segment.waypoints) {
      items += `\n${createStepItem('straight', `Continue on <strong>${wp.road}</strong> — ${formatDistance(wp.distance)}`)}`;
    }
  } else if (missingDistance > DISTANCE_THRESHOLDS.minMissingDistance) {
    items += `\n${createStepItem('straight', `Continue on route — ${formatDistance(missingDistance)}`)}`;
  }

  if (!items) {
    items = createStepItem('straight', 'Follow the route shown on map');
  }

  return items;
}

function formatStepWithIcon(step: ProcessedStep): string {
  const iconType = getStepIconType(step.instruction, step.modifier);
  const text = formatStepInstruction(step);
  return createStepItem(iconType, text);
}

function createStepItem(iconType: string, text: string): string {
  const icon = DIRECTION_ICONS[iconType] || DIRECTION_ICONS['straight'];
  return `<li><span class="dir-icon">${icon}</span><span class="dir-text">${text}</span></li>`;
}
