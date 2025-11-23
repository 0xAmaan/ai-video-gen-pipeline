import React from 'react';
import type { Clip } from '@/lib/editor/types';
import type { AffectedClipPreview } from '@/lib/editor/hooks/useSlideAffectedClips';

interface SlidePositionPreviewProps {
  /** The clip being slid (with preview position) */
  activeClip: Clip;
  /** New preview position for active clip */
  previewPosition: number;
  /** Clips that will be affected by the slide */
  affectedClips: AffectedClipPreview[];
  /** Timeline zoom level (pixels per second) */
  zoom: number;
  /** Timeline horizontal scroll offset */
  scrollLeft: number;
  /** Container height for full-height overlays */
  containerHeight: number;
}

/**
 * Renders semi-transparent SVG overlays showing preview positions during slide editing.
 * - Active clip: blue dashed outline at new position
 * - Affected clips: yellow semi-transparent fill showing shift
 */
export const SlidePositionPreview: React.FC<SlidePositionPreviewProps> = React.memo(({
  activeClip,
  previewPosition,
  affectedClips,
  zoom,
  scrollLeft,
  containerHeight,
}) => {
  // Calculate pixel positions for active clip
  const activePreviewX = (previewPosition * zoom) - scrollLeft;
  const activeWidth = activeClip.duration * zoom;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 10 }}
    >
      <svg width="100%" height={containerHeight}>
        {/* Active clip preview position (blue dashed outline) */}
        <rect
          x={activePreviewX}
          y={0}
          width={activeWidth}
          height={containerHeight}
          fill="rgba(59, 130, 246, 0.15)"
          stroke="rgb(59, 130, 246)"
          strokeWidth={2}
          strokeDasharray="8 4"
          rx={4}
        />

        {/* Label for active clip */}
        <g>
          <rect
            x={activePreviewX + 4}
            y={8}
            width={80}
            height={20}
            fill="rgba(59, 130, 246, 0.9)"
            rx={3}
          />
          <text
            x={activePreviewX + 44}
            y={22}
            textAnchor="middle"
            fill="white"
            fontSize={11}
            fontWeight="600"
            fontFamily="system-ui, sans-serif"
          >
            New Position
          </text>
        </g>

        {/* Affected clips preview positions (yellow semi-transparent) */}
        {affectedClips.map(({ clip, previewStart }) => {
          const affectedX = (previewStart * zoom) - scrollLeft;
          const affectedWidth = clip.duration * zoom;

          return (
            <g key={clip.id}>
              {/* Semi-transparent fill showing shift */}
              <rect
                x={affectedX}
                y={0}
                width={affectedWidth}
                height={containerHeight}
                fill="rgba(251, 191, 36, 0.2)"
                stroke="rgb(251, 191, 36)"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                rx={4}
              />

              {/* Small shift indicator arrow */}
              <g>
                <rect
                  x={affectedX + 4}
                  y={containerHeight - 28}
                  width={60}
                  height={18}
                  fill="rgba(251, 191, 36, 0.9)"
                  rx={3}
                />
                <text
                  x={affectedX + 34}
                  y={containerHeight - 15}
                  textAnchor="middle"
                  fill="white"
                  fontSize={10}
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                >
                  Will shift
                </text>
              </g>
            </g>
          );
        })}

        {/* Connection line from original to preview position for active clip */}
        <line
          x1={(activeClip.start * zoom) - scrollLeft + (activeWidth / 2)}
          y1={containerHeight / 2}
          x2={activePreviewX + (activeWidth / 2)}
          y2={containerHeight / 2}
          stroke="rgb(59, 130, 246)"
          strokeWidth={2}
          strokeDasharray="4 2"
          opacity={0.5}
        />
      </svg>
    </div>
  );
});

SlidePositionPreview.displayName = 'SlidePositionPreview';
