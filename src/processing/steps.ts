/**
 * Step processing - simplified, trust OSRM data
 */

import { RouteStep, RouteSegment, ProcessedStep } from '../types';
import { formatDistance } from '../utils/format';
import { findSegmentForCoordinate } from './route';

/**
 * Group steps by segment using stepRange
 */
export function groupStepsBySegment(
  steps: RouteStep[],
  segments: RouteSegment[]
): RouteStep[][] {
  if (segments[0]?.stepRange) {
    return segments.map(seg => {
      const [start, end] = seg.stepRange!;
      return steps.slice(start, end + 1);
    });
  }

  // Fallback
  const segmentSteps: RouteStep[][] = segments.map(() => []);
  for (const step of steps) {
    if (!step.location) continue;
    const idx = findSegmentForCoordinate(step.location[0], step.location[1], segments);
    segmentSteps[idx].push(step);
  }
  return segmentSteps;
}

/**
 * Convert steps directly to display format - NO FILTERING
 */
export function processStepsForDisplay(steps: RouteStep[]): ProcessedStep[] {
  return steps.map(step => ({
    instruction: step.instruction,
    modifier: step.modifier || null,
    name: step.name,
    distance: step.distance,
  }));
}

/**
 * Filter to reasonable number for display
 */
export function filterStepsForDisplay(steps: ProcessedStep[], maxSteps: number = 10): ProcessedStep[] {
  // Keep all significant steps, just limit count
  return steps.slice(0, maxSteps);
}

/**
 * Format step as readable instruction
 */
export function formatStepInstruction(step: ProcessedStep): string {
  const action = formatAction(step.instruction, step.modifier);
  const dist = step.distance > 50 ? `<span class="step-dist">${formatDistance(step.distance)}</span>` : '';

  if (step.name) {
    // Use "onto" for turns, "on" for continues
    const preposition = step.instruction === 'turn' || step.instruction === 'end of road' ? 'onto' : 'on';
    return `${action} ${preposition} <strong>${step.name}</strong>${dist}`;
  }
  return `${action}${dist}`;
}

function formatAction(instruction: string, modifier?: string | null): string {
  // Format direction exactly as API says
  const dir = modifier ? modifier.toUpperCase() : '';

  switch (instruction) {
    case 'depart':
      return 'Start';
    case 'arrive':
      return 'Arrive';
    case 'turn':
      return `Turn ${dir}`.trim();
    case 'new name':
      return dir ? `Continue ${dir}` : 'Continue';
    case 'continue':
      return 'Continue';
    case 'merge':
      return dir ? `Merge ${dir}` : 'Merge';
    case 'fork':
      return dir ? `At the fork, take a ${dir}` : 'At the fork';
    case 'end of road':
      return dir ? `At the end of the road, take a ${dir}` : 'At the end of the road';
    case 'roundabout':
      return dir ? `At the roundabout, take a ${dir}` : 'Roundabout';
    case 'on ramp':
      return dir ? `On ramp ${dir}` : 'On ramp';
    case 'off ramp':
      return dir ? `Off ramp ${dir}` : 'Off ramp';
    case 'notification':
      return 'Note';
    default:
      return dir ? `Continue ${dir}` : 'Continue';
  }
}

/**
 * Get icon type for step - uses only real Lucide icons
 */
export function getStepIconType(instruction: string, modifier?: string | null): string {
  // Special instructions
  if (instruction === 'depart') return 'start';
  if (instruction === 'arrive') return 'end';
  if (instruction === 'roundabout') return 'roundabout';
  if (instruction === 'fork') return 'fork';
  if (instruction === 'merge') return 'merge';

  // For everything else, use direction-based arrows
  switch (modifier) {
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    case 'slight left':
      return 'slight-left';
    case 'slight right':
      return 'slight-right';
    case 'sharp left':
      return 'sharp-left';
    case 'sharp right':
      return 'sharp-right';
    case 'uturn':
      return 'uturn';
    default:
      return 'straight';
  }
}
