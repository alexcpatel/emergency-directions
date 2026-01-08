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
import { POI } from '../api/overpass';
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

// State Police phone numbers
const STATE_POLICE_NUMBERS: Record<string, { name: string; phone: string }> = {
  'NY': { name: 'NY State Police', phone: '(518) 457-6811' },
  'NJ': { name: 'NJ State Police', phone: '(609) 882-2000' },
  'CT': { name: 'CT State Police', phone: '(860) 685-8190' },
  'PA': { name: 'PA State Police', phone: '(717) 783-5517' },
  'MA': { name: 'MA State Police', phone: '(508) 820-2300' },
  'VT': { name: 'VT State Police', phone: '(802) 244-8727' },
  'NH': { name: 'NH State Police', phone: '(603) 223-4381' },
  'ME': { name: 'ME State Police', phone: '(207) 624-7076' },
  'RI': { name: 'RI State Police', phone: '(401) 444-1000' },
  'DE': { name: 'DE State Police', phone: '(302) 739-5901' },
  'MD': { name: 'MD State Police', phone: '(410) 653-4200' },
  'VA': { name: 'VA State Police', phone: '(804) 674-2000' },
  'WV': { name: 'WV State Police', phone: '(304) 746-2100' },
  'OH': { name: 'OH State Highway Patrol', phone: '(614) 466-2660' },
};

/**
 * Extract state abbreviation from address string
 */
function extractState(address: string): string | null {
  // Common state abbreviations
  const statePattern = /\b(NY|NJ|CT|PA|MA|VT|NH|ME|RI|DE|MD|VA|WV|OH)\b/i;
  const match = address.match(statePattern);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Generate emergency box HTML with dynamic state police numbers
 */
function generateEmergencyBox(): string {
  const startState = extractState(ROUTE_CONFIG.start.address);
  const endState = extractState(ROUTE_CONFIG.end.address);

  // Collect unique states
  const states = new Set<string>();
  if (startState) states.add(startState);
  if (endState) states.add(endState);

  // Generate state police items
  const stateItems = Array.from(states)
    .map(state => {
      const info = STATE_POLICE_NUMBERS[state];
      if (!info) return '';
      return `
    <div class="item">
      <div class="label">${info.name}</div>
      <div class="value">${info.phone}</div>
    </div>`;
    })
    .filter(Boolean)
    .join('');

  return `<div class="emergency-box">
    <div class="item">
      <div class="label">Emergency</div>
      <div class="value">911</div>
    </div>${stateItems}
  </div>`;
}

// Lucide SVG icons for directions - only real Lucide icons
const DIRECTION_ICONS: Record<string, string> = {
  // Lucide arrow-up
  'straight': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>`,
  // Lucide arrow-left
  'left': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>`,
  // Lucide arrow-right
  'right': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
  // Lucide arrow-up-left
  'slight-left': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 17 7 7"/><path d="M7 17V7h10"/></svg>`,
  // Lucide arrow-up-right
  'slight-right': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>`,
  // Lucide corner-up-left
  'sharp-left': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 14-5-5 5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`,
  // Lucide corner-up-right
  'sharp-right': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>`,
  // Lucide undo-2
  'uturn': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 14-5-5 5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>`,
  // Start marker - filled circle
  'start': `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="6"/></svg>`,
  // Lucide circle-dot
  'end': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`,
  // Lucide rotate-cw (for roundabout)
  'roundabout': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`,
  // Lucide signpost (for fork/keep)
  'fork': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3"/><path d="M18.5 13h-13L2 9.5 5.5 6h13L22 9.5Z"/><path d="M12 13v8"/></svg>`,
  // Lucide arrow-up (merge = continue forward)
  'merge': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>`,
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
export async function generateHtmlDocument(
  route: OSRMRoute,
  segments: RouteSegment[],
  segmentLocations: SegmentLocation[],
  segmentSteps: RouteStep[][],
  segmentPOIs: POI[][] = []
): Promise<string> {
  const styles = loadStyles();
  const totalDistance = formatDistance(route.distance);
  const walkingHours = route.distance / (1.34 * 3600);
  const totalDuration = `${Math.round(walkingHours)} hours`;
  const daysNeeded = calculateDaysNeeded(route.duration);

  const coordinates = route.geometry.coordinates;
  const overviewSvg = await generateOverviewMapSvg(coordinates);
  const segmentsHtml = await generateSegmentsHtml(segments, segmentLocations, segmentSteps, segmentPOIs);
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

  ${generateEmergencyBox()}
</body>
</html>`;
}

async function generateSegmentsHtml(
  segments: RouteSegment[],
  segmentLocations: SegmentLocation[],
  segmentSteps: RouteStep[][],
  segmentPOIs: POI[][]
): Promise<string> {
  const htmlParts = await Promise.all(
    segments.map((seg, i) => generateSegmentHtml(seg, segmentLocations[i], segmentSteps[i], segmentPOIs[i] || []))
  );
  return htmlParts.join('\n');
}

async function generateSegmentHtml(
  segment: RouteSegment,
  location: SegmentLocation,
  steps: RouteStep[],
  pois: POI[]
): Promise<string> {
  const segDistance = formatDistance(segment.distance);
  const segDuration = formatDuration(segment.duration);
  const mapSvg = await generateSegmentMapSvg(segment, undefined, pois);
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
