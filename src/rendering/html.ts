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
import { ROUTE_CONFIG } from '../config';
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

// Lucide SVG icons for directions
const DIRECTION_ICONS: Record<string, string> = {
  'straight': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>`,
  'left': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>`,
  'right': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
  'slight-left': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 17 7 7"/><path d="M7 17V7h10"/></svg>`,
  'slight-right': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>`,
  'sharp-left': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 18v-7a3 3 0 0 0-3-3H5"/><path d="m9 12-4-4 4-4"/></svg>`,
  'sharp-right': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18v-7a3 3 0 0 1 3-3h10"/><path d="m15 12 4-4-4-4"/></svg>`,
  'uturn': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>`,
  'start': `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="6"/></svg>`,
  'end': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`,
  'roundabout': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>`,
  'merge': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-6"/><path d="M12 8V2"/><path d="M4 14l8-6 8 6"/></svg>`,
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
    <div class="overview-map">
      ${overviewSvg}
    </div>
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
  const stepsHtml = generateStepsHtml(steps);

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

function generateStepsHtml(steps: RouteStep[]): string {
  const processedSteps = processStepsForDisplay(steps);
  const displaySteps = filterStepsForDisplay(processedSteps);

  if (displaySteps.length === 0) {
    return createStepItem('straight', 'Follow route on map');
  }

  return displaySteps.map((s) => formatStepWithIcon(s)).join('\n');
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
