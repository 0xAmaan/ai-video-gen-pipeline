import React from 'react';
import { SlipFramePreview } from './SlipFramePreview';
import { SlidePositionPreview } from './SlidePositionPreview';
import { useSlideAffectedClips } from '@/lib/editor/hooks/useSlideAffectedClips';
import type { Clip, MediaAssetMeta, Track } from '@/lib/editor/types';

export type EditingMode = 'normal' | 'slip' | 'slide';

interface SlipSlidePreviewOverlayProps {
  /** Current editing mode (normal, slip, or slide) */
  mode: EditingMode;
  /** Preview clip with updated trim/position values */
  previewClip: Clip | null;
  /** Original clip before editing */
  originalClip: Clip | null;
  /** All timeline tracks for affected clip calculation */
  tracks: Track[];
  /** Media assets lookup for video frame extraction */
  mediaAssets: Record<string, MediaAssetMeta>;
  /** Timeline zoom level (pixels per second) */
  zoom: number;
  /** Timeline horizontal scroll offset */
  scrollLeft: number;
  /** Container width for positioning */
  containerWidth: number;
  /** Container height for full-height overlays */
  containerHeight: number;
}

/**
 * Orchestrator component that renders real-time preview during slip/slide editing.
 * - Slip mode: Shows video frame preview at new trim point
 * - Slide mode: Shows semi-transparent overlays for position changes
 * - Normal mode: Renders nothing
 */
export const SlipSlidePreviewOverlay: React.FC<SlipSlidePreviewOverlayProps> = React.memo(({
  mode,
  previewClip,
  originalClip,
  tracks,
  mediaAssets,
  zoom,
  scrollLeft,
  containerWidth,
  containerHeight,
}) => {
  // Calculate affected clips for slide mode
  const { affectedClips } = useSlideAffectedClips(
    mode === 'slide' ? previewClip?.id ?? null : null,
    mode === 'slide' ? previewClip?.start ?? null : null,
    tracks
  );

  // Don't render anything in normal mode or if no preview clip
  if (mode === 'normal' || !previewClip || !originalClip) {
    return null;
  }

  // Slip mode: render frame preview
  if (mode === 'slip') {
    const asset = mediaAssets[previewClip.mediaId];
    if (!asset) {
      console.warn('[SlipSlidePreviewOverlay] Asset not found for clip:', previewClip.mediaId);
      return null;
    }

    return (
      <SlipFramePreview
        previewClip={previewClip}
        originalClip={originalClip}
        asset={asset}
        zoom={zoom}
        scrollLeft={scrollLeft}
        containerWidth={containerWidth}
      />
    );
  }

  // Slide mode: render position preview
  if (mode === 'slide') {
    return (
      <SlidePositionPreview
        activeClip={originalClip}
        previewPosition={previewClip.start}
        affectedClips={affectedClips}
        zoom={zoom}
        scrollLeft={scrollLeft}
        containerHeight={containerHeight}
      />
    );
  }

  return null;
});

SlipSlidePreviewOverlay.displayName = 'SlipSlidePreviewOverlay';
