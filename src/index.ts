/**
 * Emergency Directions Generator
 *
 * Generates a printable walking route from Columbia University to Sherman, CT
 * using OpenStreetMap routing and geocoding APIs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ROUTE_CONFIG, OUTPUT_CONFIG, ROUTE_CONFIG_PROCESSING } from './config';
import { fetchRoute, extractSteps } from './api/osrm';
import { fetchSegmentLocations } from './api/nominatim';
import { fetchPOIsForSegments } from './api/overpass';
import { segmentRoute } from './processing/route';
import { groupStepsBySegment } from './processing/steps';
import { generateHtmlDocument } from './rendering/html';
import { formatDistance, formatDuration } from './utils/format';

async function main(): Promise<void> {
  const startTime = Date.now();

  try {
    console.log('=== Emergency Walking Directions Generator ===\n');

    // Step 1: Fetch route from OSRM
    const route = await fetchRoute(ROUTE_CONFIG.start, ROUTE_CONFIG.end);
    console.log(`Route found: ${formatDistance(route.distance)}, ${formatDuration(route.duration)}\n`);

    // Step 2: Extract navigation steps (use OSRM data as-is)
    const steps = extractSteps(route);
    console.log(`Total navigation steps: ${steps.length}`);

    // Debug: show first 10 steps
    console.log('\nFirst 10 steps from OSRM:');
    steps.slice(0, 10).forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.instruction} ${s.modifier || ''} -> "${s.name || '(unnamed)'}" (${Math.round(s.distance)}m)`);
    });
    console.log('');

    // Step 3: Segment the route by distance (~1 mile per segment)
    const segments = segmentRoute(route, undefined, steps);
    console.log(`Route split into ${segments.length} segments\n`);

    // Step 4: Fetch location names (this is the slow part due to rate limiting)
    const segmentLocations = await fetchSegmentLocations(segments);

    // Step 5: Group steps by segment
    const segmentSteps = groupStepsBySegment(steps, segments);

    // Debug: show step distribution
    console.log('\nSteps per segment:');
    segmentSteps.forEach((steps, i) => {
      const roads = steps.map(s => `${s.instruction}:${s.name}(${Math.round(s.distance)}m)`).join(', ');
      console.log(`  Segment ${i + 1}: ${steps.length} steps - ${roads || 'none'}`);
    });

    // Step 6: Fetch POIs for each segment
    console.log('');
    const segmentBounds = segments.map(s => s.bounds);
    const segmentPOIs = await fetchPOIsForSegments(segmentBounds);

    // Step 7: Generate HTML document (fetches and embeds map tiles)
    console.log('\nGenerating HTML with embedded map tiles...');
    const html = await generateHtmlDocument(route, segments, segmentLocations, segmentSteps, segmentPOIs);

    // Step 8: Write output
    const outputDir = path.join(__dirname, '..', OUTPUT_CONFIG.directory);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, OUTPUT_CONFIG.filename);
    fs.writeFileSync(outputPath, html);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nOutput written to: ${outputPath}`);
    console.log(`Total time: ${elapsed}s`);
  } catch (error) {
    console.error('Error generating directions:', error);
    process.exit(1);
  }
}

main();
