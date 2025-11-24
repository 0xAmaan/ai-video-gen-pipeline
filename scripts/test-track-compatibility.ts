/**
 * Manual test script for track compatibility utilities
 * Run with: npx tsx scripts/test-track-compatibility.ts
 */

import { getTrackType, isTrackCompatible, getCompatibleTracks } from '../lib/editor/trackCompatibility';
import type { Track } from '../lib/editor/types';

// Mock track factory
const createMockTrack = (id: string, kind: Track['kind']): Track => ({
  id,
  name: `${kind.toUpperCase()}-${id}`,
  kind,
  allowOverlap: false,
  clips: [],
  locked: false,
  muted: false,
  solo: false,
  volume: 1.0,
  zIndex: kind === 'video' ? 1 : 0,
  height: kind === 'audio' ? 80 : 120,
  visible: true,
});

console.log('🧪 Testing Track Compatibility Utilities\n');

// Test 1: getTrackType
console.log('Test 1: getTrackType');
const videoTrack = createMockTrack('v1', 'video');
const audioTrack = createMockTrack('a1', 'audio');
const overlayTrack = createMockTrack('o1', 'overlay');
const fxTrack = createMockTrack('fx1', 'fx');

console.log(`  Video track type: ${getTrackType(videoTrack)} (expected: video)`);
console.log(`  Audio track type: ${getTrackType(audioTrack)} (expected: audio)`);
console.log(`  Overlay track type: ${getTrackType(overlayTrack)} (expected: video)`);
console.log(`  FX track type: ${getTrackType(fxTrack)} (expected: unknown)`);
console.log();

// Test 2: isTrackCompatible
console.log('Test 2: isTrackCompatible');
const videoTrack2 = createMockTrack('v2', 'video');
const audioTrack2 = createMockTrack('a2', 'audio');

console.log(`  Video -> Video: ${isTrackCompatible(videoTrack, videoTrack2)} (expected: true)`);
console.log(`  Video -> Overlay: ${isTrackCompatible(videoTrack, overlayTrack)} (expected: true)`);
console.log(`  Audio -> Audio: ${isTrackCompatible(audioTrack, audioTrack2)} (expected: true)`);
console.log(`  Video -> Audio: ${isTrackCompatible(videoTrack, audioTrack)} (expected: false)`);
console.log(`  Audio -> Video: ${isTrackCompatible(audioTrack, videoTrack)} (expected: false)`);
console.log(`  FX -> Video: ${isTrackCompatible(fxTrack, videoTrack)} (expected: false)`);
console.log();

// Test 3: getCompatibleTracks
console.log('Test 3: getCompatibleTracks');
const allTracks: Track[] = [
  videoTrack,
  videoTrack2,
  overlayTrack,
  audioTrack,
  audioTrack2,
  fxTrack,
];

const videoCompatible = getCompatibleTracks('v1', allTracks);
const audioCompatible = getCompatibleTracks('a1', allTracks);
const fxCompatible = getCompatibleTracks('fx1', allTracks);

console.log(`  Compatible tracks for video (v1): [${videoCompatible.map(t => t.id).join(', ')}] (expected: v2, o1)`);
console.log(`  Compatible tracks for audio (a1): [${audioCompatible.map(t => t.id).join(', ')}] (expected: a2)`);
console.log(`  Compatible tracks for fx (fx1): [${fxCompatible.map(t => t.id).join(', ')}] (expected: empty)`);
console.log();

// Verify results
const allTestsPassed = 
  getTrackType(videoTrack) === 'video' &&
  getTrackType(audioTrack) === 'audio' &&
  getTrackType(overlayTrack) === 'video' &&
  getTrackType(fxTrack) === 'unknown' &&
  isTrackCompatible(videoTrack, videoTrack2) === true &&
  isTrackCompatible(videoTrack, overlayTrack) === true &&
  isTrackCompatible(audioTrack, audioTrack2) === true &&
  isTrackCompatible(videoTrack, audioTrack) === false &&
  isTrackCompatible(audioTrack, videoTrack) === false &&
  isTrackCompatible(fxTrack, videoTrack) === false &&
  videoCompatible.length === 2 &&
  videoCompatible.some(t => t.id === 'v2') &&
  videoCompatible.some(t => t.id === 'o1') &&
  audioCompatible.length === 1 &&
  audioCompatible[0].id === 'a2' &&
  fxCompatible.length === 0;

if (allTestsPassed) {
  console.log('✅ All tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed!');
  process.exit(1);
}
