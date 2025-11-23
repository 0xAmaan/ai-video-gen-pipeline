import React, { useEffect, useRef } from 'react';
import { useVideoFramePreview } from '@/lib/editor/hooks/useVideoFramePreview';
import type { Clip, MediaAssetMeta } from '@/lib/editor/types';

interface SlipFramePreviewProps {
  /** The clip being slipped with preview trimStart */
  previewClip: Clip;
  /** Original clip for positioning reference */
  originalClip: Clip;
  /** Media asset for video source */
  asset: MediaAssetMeta;
  /** Timeline zoom level (pixels per second) */
  zoom: number;
  /** Timeline horizontal scroll offset */
  scrollLeft: number;
  /** Container width for positioning */
  containerWidth: number;
}

/**
 * Renders a small video frame preview during slip editing operations.
 * Shows the frame at the current preview trimStart position with timecode overlay.
 * Positioned above the clip being edited on the timeline.
 */
export const SlipFramePreview: React.FC<SlipFramePreviewProps> = React.memo(({
  previewClip,
  originalClip,
  asset,
  zoom,
  scrollLeft,
  containerWidth,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch frame at preview trimStart position
  const { frame, loading, error } = useVideoFramePreview(
    asset,
    previewClip.trimStart,
    true // Always enabled when component is mounted
  );

  // Fix: Initialize canvas size once on mount (expensive operation)
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = 160;
    canvas.height = 90;
  }, []);

  // Render frame to canvas when available
  useEffect(() => {
    if (!frame || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const previewWidth = 160;
      const previewHeight = 90;

      // Clear canvas before drawing
      ctx.clearRect(0, 0, previewWidth, previewHeight);

      // Draw frame to canvas (scaled to fit)
      ctx.drawImage(frame, 0, 0, previewWidth, previewHeight);

      // Add timecode overlay
      const timecode = formatTimecode(previewClip.trimStart);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, previewHeight - 24, previewWidth, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(timecode, previewWidth / 2, previewHeight - 8);
    } catch (err) {
      console.error('[SlipFramePreview] Failed to render frame:', err);
    }
  }, [frame, previewClip.trimStart]);

  // Calculate position above the clip
  const clipPixelPosition = (originalClip.start * zoom) - scrollLeft;
  const clipWidth = originalClip.duration * zoom;
  const clipCenterX = clipPixelPosition + (clipWidth / 2);

  // Clamp to visible area
  const previewWidth = 160;
  const previewX = Math.max(10, Math.min(containerWidth - previewWidth - 10, clipCenterX - previewWidth / 2));
  const previewY = 40; // Fixed distance above timeline

  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        left: `${previewX}px`,
        top: `${previewY}px`,
      }}
    >
      <div className="bg-gray-900 border-2 border-blue-500 rounded-lg shadow-2xl overflow-hidden">
        {/* Canvas for video frame */}
        <canvas
          ref={canvasRef}
          className="block"
          style={{ width: '160px', height: '90px' }}
        />

        {/* Loading indicator */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error indicator */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/80">
            <span className="text-xs text-white px-2 text-center">
              Preview Error
            </span>
          </div>
        )}

        {/* Label */}
        <div className="bg-blue-500 text-white text-xs font-semibold px-2 py-1 text-center">
          Slip Preview
        </div>
      </div>
    </div>
  );
});

SlipFramePreview.displayName = 'SlipFramePreview';

/**
 * Format seconds to MM:SS.mmm timecode
 */
function formatTimecode(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}
