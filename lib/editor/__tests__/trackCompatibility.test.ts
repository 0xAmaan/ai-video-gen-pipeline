import { describe, it, expect } from '@jest/globals';
import { getTrackType, isTrackCompatible, getCompatibleTracks } from '../trackCompatibility';
import type { Track } from '../types';

// Mock track factory
const createMockTrack = (id: string, kind: Track['kind']): Track => ({
  id,
  kind,
  allowOverlap: false,
  clips: [],
  locked: false,
  muted: false,
  volume: 1.0,
});

describe('Track Compatibility Utilities', () => {
  describe('getTrackType', () => {
    it('should return "video" for video tracks', () => {
      const track = createMockTrack('v1', 'video');
      expect(getTrackType(track)).toBe('video');
    });

    it('should return "video" for overlay tracks', () => {
      const track = createMockTrack('o1', 'overlay');
      expect(getTrackType(track)).toBe('video');
    });

    it('should return "audio" for audio tracks', () => {
      const track = createMockTrack('a1', 'audio');
      expect(getTrackType(track)).toBe('audio');
    });

    it('should return "unknown" for fx tracks', () => {
      const track = createMockTrack('fx1', 'fx');
      expect(getTrackType(track)).toBe('unknown');
    });
  });

  describe('isTrackCompatible', () => {
    it('should return true for video to video tracks', () => {
      const videoTrack1 = createMockTrack('v1', 'video');
      const videoTrack2 = createMockTrack('v2', 'video');
      expect(isTrackCompatible(videoTrack1, videoTrack2)).toBe(true);
    });

    it('should return true for video to overlay tracks', () => {
      const videoTrack = createMockTrack('v1', 'video');
      const overlayTrack = createMockTrack('o1', 'overlay');
      expect(isTrackCompatible(videoTrack, overlayTrack)).toBe(true);
    });

    it('should return true for overlay to video tracks', () => {
      const overlayTrack = createMockTrack('o1', 'overlay');
      const videoTrack = createMockTrack('v1', 'video');
      expect(isTrackCompatible(overlayTrack, videoTrack)).toBe(true);
    });

    it('should return true for audio to audio tracks', () => {
      const audioTrack1 = createMockTrack('a1', 'audio');
      const audioTrack2 = createMockTrack('a2', 'audio');
      expect(isTrackCompatible(audioTrack1, audioTrack2)).toBe(true);
    });

    it('should return false for video to audio tracks', () => {
      const videoTrack = createMockTrack('v1', 'video');
      const audioTrack = createMockTrack('a1', 'audio');
      expect(isTrackCompatible(videoTrack, audioTrack)).toBe(false);
    });

    it('should return false for audio to video tracks', () => {
      const audioTrack = createMockTrack('a1', 'audio');
      const videoTrack = createMockTrack('v1', 'video');
      expect(isTrackCompatible(audioTrack, videoTrack)).toBe(false);
    });

    it('should return false for unknown track types', () => {
      const fxTrack = createMockTrack('fx1', 'fx');
      const videoTrack = createMockTrack('v1', 'video');
      expect(isTrackCompatible(fxTrack, videoTrack)).toBe(false);
      expect(isTrackCompatible(videoTrack, fxTrack)).toBe(false);
    });
  });

  describe('getCompatibleTracks', () => {
    const tracks: Track[] = [
      createMockTrack('v1', 'video'),
      createMockTrack('v2', 'video'),
      createMockTrack('o1', 'overlay'),
      createMockTrack('a1', 'audio'),
      createMockTrack('a2', 'audio'),
      createMockTrack('fx1', 'fx'),
    ];

    it('should return compatible video/overlay tracks for a video track', () => {
      const compatible = getCompatibleTracks('v1', tracks);
      expect(compatible).toHaveLength(2);
      expect(compatible.map(t => t.id)).toEqual(['v2', 'o1']);
    });

    it('should return compatible video/overlay tracks for an overlay track', () => {
      const compatible = getCompatibleTracks('o1', tracks);
      expect(compatible).toHaveLength(2);
      expect(compatible.map(t => t.id)).toEqual(['v1', 'v2']);
    });

    it('should return compatible audio tracks for an audio track', () => {
      const compatible = getCompatibleTracks('a1', tracks);
      expect(compatible).toHaveLength(1);
      expect(compatible.map(t => t.id)).toEqual(['a2']);
    });

    it('should return empty array for fx tracks', () => {
      const compatible = getCompatibleTracks('fx1', tracks);
      expect(compatible).toHaveLength(0);
    });

    it('should return empty array for non-existent track', () => {
      const compatible = getCompatibleTracks('nonexistent', tracks);
      expect(compatible).toHaveLength(0);
    });

    it('should not include the source track itself', () => {
      const compatible = getCompatibleTracks('v1', tracks);
      expect(compatible.find(t => t.id === 'v1')).toBeUndefined();
    });
  });
});
