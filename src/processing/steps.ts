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
  const dist = step.distance > 50 ? ` — ${formatDistance(step.distance)}` : '';

  if (step.name) {
    return `${action} on <strong>${step.name}</strong>${dist}`;
  }
  return `${action}${dist}`;
}

function formatAction(instruction: string, modifier?: string | null): string {
  const dir = modifier ? ` ${modifier.toUpperCase()}` : '';

  switch (instruction) {
    case 'depart':
      return 'START';
    case 'arrive':
      return 'ARRIVE';
    case 'turn':
      return `Turn${dir}`;
    case 'new name':
    case 'continue':
      return 'Continue';
    case 'merge':
      return 'Merge';
    case 'fork':
      return `Keep${dir}`;
    case 'end of road':
      return `End of road, turn${dir}`;
    case 'roundabout':
      return 'Roundabout';
    default:
      return 'Continue';
  }
}

/**
 * Get icon type for step
 */
export function getStepIconType(instruction: string, modifier?: string | null): string {
  if (modifier === 'left' || modifier === 'slight left') return 'left';
  if (modifier === 'right' || modifier === 'slight right') return 'right';
  if (instruction === 'depart') return 'start';
  if (instruction === 'arrive') return 'end';
  return 'straight';
}
