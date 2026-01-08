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
  return segments.map(seg => {
    if (seg.stepRange) {
      const [start, end] = seg.stepRange;
      return steps.slice(start, end + 1);
    }
    // Fallback: find steps whose locations are within this segment's bounds
    const segmentSteps: RouteStep[] = [];
    for (const step of steps) {
      if (!step.location) continue;
      const [lon, lat] = step.location;
      // Check if step is within segment bounds
      if (lon >= seg.bounds.minLon && lon <= seg.bounds.maxLon &&
        lat >= seg.bounds.minLat && lat <= seg.bounds.maxLat) {
        segmentSteps.push(step);
      }
    }
    return segmentSteps;
  });
}

/**
 * Convert steps directly to display format - NO FILTERING
 */
export function processStepsForDisplay(steps: RouteStep[]): ProcessedStep[] {
  return steps.map(step => ({
    instruction: step.instruction,
    modifier: step.modifier || null,
    name: step.name,
    ref: step.ref,
    distance: step.distance,
  }));
}

/**
 * Filter steps for display - return all steps from OSRM unchanged
 */
export function filterStepsForDisplay(steps: ProcessedStep[], _maxSteps?: number): ProcessedStep[] {
  // Return all steps exactly as OSRM provided them
  return steps;
}

/**
 * Format step as readable instruction
 */
export function formatStepInstruction(step: ProcessedStep): string {
  const action = formatAction(step.instruction, step.modifier);
  const dist = step.distance > 50 ? `<span class="step-dist">${formatDistance(step.distance)}</span>` : '';

  // Build road name: prefer name, fall back to ref (route number)
  let roadName = '';
  if (step.name && step.name.trim()) {
    roadName = step.name;
    // Add route number in parentheses if different from name
    if (step.ref && step.ref.trim() && !step.name.includes(step.ref)) {
      roadName += ` (${step.ref})`;
    }
  } else if (step.ref && step.ref.trim()) {
    // Only route number available
    roadName = step.ref;
  }

  if (roadName) {
    // Use "onto" for turns/direction changes, "on" for continues
    const isTurn = step.instruction === 'turn' || step.instruction === 'end of road' || step.instruction === 'fork';
    const preposition = isTurn ? 'onto' : 'on';
    return `${action} ${preposition} <strong>${roadName}</strong>${dist}`;
  }

  // No road info - just show action with distance
  return `${action}${dist}`;
}

function formatAction(instruction: string, modifier?: string | null): string {
  // Format direction - handle "straight" as "continue" not "turn"
  const dir = modifier ? modifier.toUpperCase() : '';
  const isStraight = modifier === 'straight' || !modifier;

  switch (instruction) {
    case 'depart':
      return 'Start';
    case 'arrive':
      return 'Arrive';
    case 'turn':
      // "Turn STRAIGHT" doesn't make sense - use "Continue" instead
      if (isStraight) return 'Continue';
      return `Turn ${dir}`;
    case 'new name':
      // Road name changes
      if (isStraight) return 'Continue';
      return `Bear ${dir}`;
    case 'continue':
      return 'Continue';
    case 'merge':
      return dir && !isStraight ? `Merge ${dir}` : 'Merge';
    case 'fork':
      return dir && !isStraight ? `At the fork, take a ${dir}` : 'At the fork, stay on route';
    case 'end of road':
      return dir && !isStraight ? `At the end of the road, take a ${dir}` : 'At the end of the road';
    case 'roundabout':
      return dir && !isStraight ? `At the roundabout, take a ${dir}` : 'Roundabout';
    case 'on ramp':
      return dir && !isStraight ? `On ramp ${dir}` : 'On ramp';
    case 'off ramp':
      return dir && !isStraight ? `Off ramp ${dir}` : 'Off ramp';
    case 'notification':
      return 'Note';
    default:
      return 'Continue';
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
