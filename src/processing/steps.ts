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
  // Format modifier nicely
  const formatMod = (m: string | null | undefined): string => {
    if (!m) return '';
    switch (m) {
      case 'sharp left': return ' SHARP LEFT';
      case 'sharp right': return ' SHARP RIGHT';
      case 'slight left': return ' SLIGHT LEFT';
      case 'slight right': return ' SLIGHT RIGHT';
      case 'left': return ' LEFT';
      case 'right': return ' RIGHT';
      case 'straight': return ' STRAIGHT';
      case 'uturn': return ' U-TURN';
      default: return ` ${m.toUpperCase()}`;
    }
  };

  const dir = formatMod(modifier);

  switch (instruction) {
    case 'depart':
      return 'START';
    case 'arrive':
      return 'ARRIVE';
    case 'turn':
      return `Turn${dir}`;
    case 'new name':
      return `Continue${dir || ' STRAIGHT'}`;
    case 'continue':
      return 'Continue';
    case 'merge':
      return `Merge${dir}`;
    case 'fork':
      return `Keep${dir || ' RIGHT'}`;
    case 'end of road':
      return `End of road${dir}`;
    case 'roundabout':
      return `Roundabout${dir}`;
    case 'on ramp':
      return `On ramp${dir}`;
    case 'off ramp':
      return `Exit${dir}`;
    case 'notification':
      return 'Note';
    default:
      return `Continue${dir}`;
  }
}

/**
 * Get icon type for step - handle all OSRM modifiers
 */
export function getStepIconType(instruction: string, modifier?: string | null): string {
  // Handle specific instructions first
  if (instruction === 'depart') return 'start';
  if (instruction === 'arrive') return 'end';
  if (instruction === 'roundabout') return 'roundabout';
  if (instruction === 'merge') return 'merge';
  if (instruction === 'fork') return 'fork';

  // Handle modifiers
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
    case 'straight':
      return 'straight';
    default:
      return 'straight';
  }
}
