/**
 * Navigation step processing
 */

import { RouteStep, RouteSegment, ProcessedStep } from '../types';
import { HIGHWAY_TERMS, DISTANCE_THRESHOLDS } from '../config';
import { formatDistance } from '../utils/format';
import { findSegmentForCoordinate } from './route';

/**
 * Group steps by their corresponding segment
 */
export function groupStepsBySegment(
  steps: RouteStep[],
  segments: RouteSegment[]
): RouteStep[][] {
  const segmentSteps: RouteStep[][] = segments.map(() => []);

  for (const step of steps) {
    if (!step.location) continue;

    const [lon, lat] = step.location;
    const segmentIndex = findSegmentForCoordinate(lon, lat, segments);
    segmentSteps[segmentIndex].push(step);
  }

  return segmentSteps;
}

/**
 * Process and condense steps for display
 */
export function processStepsForDisplay(steps: RouteStep[]): ProcessedStep[] {
  const condensedSteps: ProcessedStep[] = [];
  let currentRoad: string | null = null;
  let currentDistance = 0;
  let currentInstruction: string | null = null;

  for (const step of steps) {
    const roadName = step.name || '';
    const isTurn = step.instruction === 'turn' || step.instruction === 'fork';
    const isSignificant =
      step.instruction === 'depart' ||
      step.instruction === 'arrive' ||
      isTurn;

    if (isSignificant) {
      // Flush any accumulated distance
      if (currentRoad && currentDistance > 0) {
        condensedSteps.push({
          instruction: currentInstruction || 'continue',
          modifier: null,
          name: currentRoad,
          distance: currentDistance,
        });
      }
      // Add this turn
      condensedSteps.push({
        instruction: step.instruction,
        modifier: step.modifier,
        name: roadName,
        distance: step.distance,
      });
      currentRoad = roadName;
      currentDistance = 0;
      currentInstruction = null;
    } else {
      // Accumulate
      if (roadName && roadName !== currentRoad && currentDistance > 0) {
        // Road changed, flush
        if (currentRoad) {
          condensedSteps.push({
            instruction: currentInstruction || 'continue',
            modifier: null,
            name: currentRoad,
            distance: currentDistance,
          });
        }
        currentRoad = roadName;
        currentDistance = step.distance || 0;
        currentInstruction = step.instruction;
      } else {
        currentDistance += step.distance || 0;
        if (roadName) currentRoad = roadName;
        if (!currentInstruction) currentInstruction = step.instruction;
      }
    }
  }

  // Flush remaining
  if (currentRoad && currentDistance > 0) {
    condensedSteps.push({
      instruction: currentInstruction || 'continue',
      modifier: null,
      name: currentRoad,
      distance: currentDistance,
    });
  }

  return condensedSteps;
}

/**
 * Format a step as human-readable instruction
 */
export function formatStepInstruction(step: ProcessedStep): string {
  const { instruction, modifier, name, distance } = step;

  // Handle highway names
  let roadName = name || '';
  const isHighway = HIGHWAY_TERMS.some((term) =>
    roadName.toLowerCase().includes(term)
  );

  if (isHighway) {
    roadName = '(follow road - stay on shoulder/parallel street if possible)';
  }

  // Format action
  let action = formatAction(instruction, modifier);

  // Build instruction string
  const distStr = distance > 100 ? ` — ${formatDistance(distance)}` : '';
  const road = roadName ? ` on ${roadName}` : '';

  return `${action}${road}${distStr}`;
}

function formatAction(instruction: string, modifier?: string | null): string {
  switch (instruction) {
    case 'turn':
      if (modifier === 'left') return 'Turn LEFT';
      if (modifier === 'right') return 'Turn RIGHT';
      return `Turn ${modifier || ''}`;
    case 'new name':
    case 'continue':
      return 'Continue straight';
    case 'merge':
      return 'Merge/Continue';
    case 'depart':
      return 'START walking';
    case 'arrive':
      return 'ARRIVE at destination';
    case 'fork':
      return modifier === 'left' ? 'Keep LEFT' : 'Keep RIGHT';
    case 'roundabout':
      return 'At roundabout';
    case 'end of road':
      return 'end of road';
    default:
      return instruction || 'Continue';
  }
}

/**
 * Filter steps for display, keeping significant ones
 */
export function filterStepsForDisplay(
  steps: ProcessedStep[],
  maxSteps: number = 15
): ProcessedStep[] {
  return steps
    .filter(
      (s) =>
        s.distance > DISTANCE_THRESHOLDS.minStepDistance ||
        s.instruction === 'turn' ||
        s.instruction === 'depart' ||
        s.instruction === 'arrive' ||
        s.instruction === 'fork'
    )
    .slice(0, maxSteps);
}
