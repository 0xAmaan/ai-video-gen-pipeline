import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Timeline } from './Timeline';
import type { Sequence, TimelineSelection, MediaAssetMeta } from '@/lib/editor/types';

const createMockSequence = (clips: any[] = []): Sequence => ({
  id: 'sequence-1',
  name: 'Test Sequence',
  width: 1920,
  height: 1080,
  fps: 30,
  sampleRate: 48000,
  duration: 10,
  tracks: [
    {
      id: 'video-1',
      kind: 'video',
      allowOverlap: false,
      locked: false,
      muted: false,
      clips,
    },
    {
      id: 'audio-1',
      kind: 'audio',
      allowOverlap: true,
      locked: false,
      muted: false,
      clips: [],
    },
  ],
});

const createMockAsset = (id: string, thumbnails?: string[]): MediaAssetMeta => ({
  id,
  name: `Asset ${id}`,
  type: 'video',
  duration: 5,
  width: 1920,
  height: 1080,
  fps: 30,
  url: `https://example.com/${id}.mp4`,
  thumbnails,
  thumbnailCount: thumbnails?.length,
});

describe('Timeline - Thumbnail Rendering', () => {
  const defaultProps = {
    selection: { clipIds: [], trackIds: [] } as TimelineSelection,
    zoom: 1,
    snap: true,
    currentTime: 0,
    assets: [] as MediaAssetMeta[],
    onSelectionChange: vi.fn(),
    onMoveClip: vi.fn(),
    onTrimClip: vi.fn(),
    onSeek: vi.fn(),
    onZoomChange: vi.fn(),
  };

  describe('Video Clip Thumbnails', () => {
    it('should render thumbnails for video clips with thumbnails', () => {
      const thumbnails = [
        'data:image/jpeg;base64,thumb1',
        'data:image/jpeg;base64,thumb2',
        'data:image/jpeg;base64,thumb3',
      ];

      const clips = [
        {
          id: 'clip-1',
          mediaId: 'asset-1',
          trackId: 'video-1',
          kind: 'video' as const,
          start: 0,
          duration: 5,
          trimStart: 0,
          trimEnd: 0,
          opacity: 1,
          volume: 1,
          effects: [],
          transitions: [],
        },
      ];

      const assets = [createMockAsset('asset-1', thumbnails)];
      const sequence = createMockSequence(clips);

      const { container } = render(<Timeline {...defaultProps} sequence={sequence} assets={assets} />);

      // Check that thumbnail images are rendered
      const images = container.querySelectorAll('img[src^="data:image/jpeg"]');
      expect(images.length).toBeGreaterThan(0);
      images.forEach((img) => {
        expect(img).toHaveAttribute('src');
        expect(img.getAttribute('src')).toContain('data:image/jpeg');
      });
    });

    it('should not render thumbnails for clips without thumbnails', () => {
      const clips = [
        {
          id: 'clip-1',
          mediaId: 'asset-1',
          trackId: 'video-1',
          kind: 'video' as const,
          start: 0,
          duration: 5,
          trimStart: 0,
          trimEnd: 0,
          opacity: 1,
          volume: 1,
          effects: [],
          transitions: [],
        },
      ];

      const assets = [createMockAsset('asset-1')]; // No thumbnails
      const sequence = createMockSequence(clips);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      render(<Timeline {...defaultProps} sequence={sequence} assets={assets} />);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Timeline] No thumbnails yet')
      );

      consoleSpy.mockRestore();
    });

    it('should log warning when asset not found for clip', () => {
      const clips = [
        {
          id: 'clip-1',
          mediaId: 'non-existent-asset',
          trackId: 'video-1',
          kind: 'video' as const,
          start: 0,
          duration: 5,
          trimStart: 0,
          trimEnd: 0,
          opacity: 1,
          volume: 1,
          effects: [],
          transitions: [],
        },
      ];

      const sequence = createMockSequence(clips);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(<Timeline {...defaultProps} sequence={sequence} assets={[]} />);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Timeline] Asset not found')
      );

      consoleSpy.mockRestore();
    });

    it('should not render thumbnails for audio clips', () => {
      const clips = [
        {
          id: 'clip-1',
          mediaId: 'asset-1',
          trackId: 'audio-1',
          kind: 'audio' as const,
          start: 0,
          duration: 5,
          trimStart: 0,
          trimEnd: 0,
          opacity: 1,
          volume: 1,
          effects: [],
          transitions: [],
        },
      ];

      const thumbnails = ['data:image/jpeg;base64,thumb1'];
      const assets = [{ ...createMockAsset('asset-1', thumbnails), type: 'audio' as const }];

      const sequence: Sequence = {
        ...createMockSequence(),
        tracks: [
          ...createMockSequence().tracks.slice(0, 1),
          {
            id: 'audio-1',
            kind: 'audio',
            allowOverlap: true,
            locked: false,
            muted: false,
            clips,
          },
        ],
      };

      const { container } = render(<Timeline {...defaultProps} sequence={sequence} assets={assets} />);

      const images = container.querySelectorAll('img[src^="data:image/jpeg"]');
      expect(images).toHaveLength(0);
    });
  });

  describe('Clip Information Display', () => {
    it('should display clip ID and duration', () => {
      const clips = [
        {
          id: 'clip-1',
          mediaId: 'asset-1',
          trackId: 'video-1',
          kind: 'video' as const,
          start: 0,
          duration: 5.5,
          trimStart: 0,
          trimEnd: 0,
          opacity: 1,
          volume: 1,
          effects: [],
          transitions: [],
        },
      ];

      const assets = [createMockAsset('asset-1')];
      const sequence = createMockSequence(clips);

      render(<Timeline {...defaultProps} sequence={sequence} assets={assets} />);

      expect(screen.getByText('clip-1')).toBeInTheDocument();
      expect(screen.getByText('5.50s')).toBeInTheDocument();
    });

    it('should highlight selected clips', () => {
      const clips = [
        {
          id: 'clip-1',
          mediaId: 'asset-1',
          trackId: 'video-1',
          kind: 'video' as const,
          start: 0,
          duration: 5,
          trimStart: 0,
          trimEnd: 0,
          opacity: 1,
          volume: 1,
          effects: [],
          transitions: [],
        },
      ];

      const assets = [createMockAsset('asset-1')];
      const sequence = createMockSequence(clips);
      const selection = { clipIds: ['clip-1'], trackIds: [] };

      const { container } = render(
        <Timeline {...defaultProps} sequence={sequence} assets={assets} selection={selection} />
      );

      // Find the clip container div (should have border-primary class when selected)
      const clipContainers = container.querySelectorAll('div.border-primary');
      expect(clipContainers.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive Thumbnail Rendering', () => {
    it('should calculate thumbnail count based on clip width', () => {
      const thumbnails = Array.from({ length: 15 }, (_, i) => `data:image/jpeg;base64,thumb${i}`);

      const clips = [
        {
          id: 'clip-1',
          mediaId: 'asset-1',
          trackId: 'video-1',
          kind: 'video' as const,
          start: 0,
          duration: 10, // Long clip should show more thumbnails
          trimStart: 0,
          trimEnd: 0,
          opacity: 1,
          volume: 1,
          effects: [],
          transitions: [],
        },
      ];

      const assets = [createMockAsset('asset-1', thumbnails)];
      const sequence = createMockSequence(clips);

      const { container } = render(<Timeline {...defaultProps} sequence={sequence} assets={assets} zoom={2} />);

      const images = container.querySelectorAll('img[src^="data:image/jpeg"]');
      // At higher zoom, more thumbnails should be visible
      expect(images.length).toBeGreaterThan(0);
      expect(images.length).toBeLessThanOrEqual(thumbnails.length);
    });
  });

  describe('Timeline Interactions', () => {
    it('should call onSelectionChange when clip is clicked', () => {
      const onSelectionChange = vi.fn();
      const clips = [
        {
          id: 'clip-1',
          mediaId: 'asset-1',
          trackId: 'video-1',
          kind: 'video' as const,
          start: 0,
          duration: 5,
          trimStart: 0,
          trimEnd: 0,
          opacity: 1,
          volume: 1,
          effects: [],
          transitions: [],
        },
      ];

      const assets = [createMockAsset('asset-1')];
      const sequence = createMockSequence(clips);

      render(
        <Timeline {...defaultProps} sequence={sequence} assets={assets} onSelectionChange={onSelectionChange} />
      );

      const clipElement = screen.getByText('clip-1').closest('div');
      clipElement?.click();

      expect(onSelectionChange).toHaveBeenCalledWith('clip-1');
    });
  });
});
