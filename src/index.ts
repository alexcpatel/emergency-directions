/**
 * Emergency Directions Generator
 *
 * Generates a printable walking route from Columbia University to Sherman, CT
 * using OpenStreetMap routing and geocoding APIs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ROUTE_CONFIG, OUTPUT_CONFIG, ROUTE_CONFIG_PROCESSING } from './config';
import { fetchWalkingRoute, extractSteps } from './api/osrm';
import { fetchSegmentLocations, fetchSegmentWaypoints } from './api/nominatim';
import { segmentRoute } from './processing/route';
import { groupStepsBySegment } from './processing/steps';
import { generateHtmlDocument } from './rendering/html';
import { formatDistance, formatDuration } from './utils/format';

async function main(): Promise<void> {
  const startTime = Date.now();

  try {
    console.log('=== Emergency Walking Directions Generator ===\n');

    // Step 1: Fetch walking route from OSRM
    const route = await fetchWalkingRoute(ROUTE_CONFIG.start, ROUTE_CONFIG.end);
    console.log(`Route found: ${formatDistance(route.distance)}, ${formatDuration(route.duration)}\n`);

    // Step 2: Extract navigation steps
    const steps = extractSteps(route);
    console.log(`Total navigation steps: ${steps.length}\n`);

    // Step 3: Segment the route
    const segments = segmentRoute(route, ROUTE_CONFIG_PROCESSING.numSegments);
    console.log(`Route split into ${segments.length} segments\n`);

    // Step 4: Fetch location names (this is the slow part due to rate limiting)
    const segmentLocations = await fetchSegmentLocations(segments);

    // Step 5: Fetch intermediate waypoints
    await fetchSegmentWaypoints(segments, ROUTE_CONFIG_PROCESSING.waypointsPerSegment);

    // Step 6: Group steps by segment
    const segmentSteps = groupStepsBySegment(steps, segments);

    // Step 7: Generate HTML document
    console.log('\nGenerating HTML...');
    const html = generateHtmlDocument(route, segments, segmentLocations, segmentSteps);

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
