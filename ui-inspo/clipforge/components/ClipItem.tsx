import { Rect, Group, Image as KonvaImage, Text } from "react-konva";
import { useEffect, useState } from "react";
import type { ClipItemProps } from "../types";

// Visual constants
const CLIP_HEIGHT = 120;
const CLIP_Y = 10;
const HANDLE_WIDTH = 10;

// Colors
const CLIP_STROKE = "#1e40af";
const CLIP_STROKE_SELECTED = "#FFD800"; // Yellow highlight for selected clip

/**
 * Custom hook to load an image for Konva
 */
const useImage = (src: string | null) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    console.log("Loading image from:", src);

    const img = new Image();
    img.onload = () => {
      console.log("Image loaded successfully:", src);
      setImage(img);
    };
    img.onerror = (err) => {
      console.error("Failed to load image:", src, err);
      setImage(null);
    };

    // Convert file path to safe-file:// URL
    const fileUrl = window.electronAPI.getFileUrl(src);
    console.log("Converted to URL:", fileUrl);
    img.src = fileUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return image;
};

/**
 * Component to render a single thumbnail image in the timeline
 */
const ThumbnailImage = ({
  thumbnailPath,
  clipX,
  clipY,
  clipWidth,
  clipHeight,
  thumbnails,
  index,
}: {
  thumbnailPath: string;
  clipX: number;
  clipY: number;
  clipWidth: number;
  clipHeight: number;
  thumbnails: Array<{ timestamp: number; path: string }>;
  index: number;
}) => {
  const image = useImage(thumbnailPath);

  if (!image) return null;

  // Calculate position and size for this thumbnail
  // Stretch thumbnails to fill entire clip width proportionally
  const thumbWidth = clipWidth / thumbnails.length;
  const thumbX = clipX + index * thumbWidth;

  // Calculate aspect ratio and sizing
  // Use "cover" behavior - fill entire space, crop excess
  const imageAspect = image.width / image.height;
  const clipAspect = thumbWidth / clipHeight;

  let renderWidth, renderHeight, offsetX, offsetY;

  if (imageAspect > clipAspect) {
    // Image is wider - fit by width to ensure no gaps
    renderWidth = thumbWidth;
    renderHeight = renderWidth / imageAspect;
    offsetX = 0;
    offsetY = (clipHeight - renderHeight) / 2;
  } else {
    // Image is taller - fit by height to ensure no gaps
    renderHeight = clipHeight;
    renderWidth = renderHeight * imageAspect;
    offsetX = -(renderWidth - thumbWidth) / 2;
    offsetY = 0;
  }

  return (
    <Group
      x={thumbX}
      y={clipY}
      clipX={0}
      clipY={0}
      clipWidth={thumbWidth}
      clipHeight={clipHeight}
      listening={false}
    >
      <KonvaImage
        image={image}
        x={offsetX}
        y={offsetY}
        width={renderWidth}
        height={renderHeight}
        listening={false}
      />
    </Group>
  );
};

export const ClipItem = ({
  clip,
  isSelected,
  pixelsPerSecond,
  xOffset = 0,
  isDragging = false,
  dragX,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTrim,
}: ClipItemProps) => {
  // Use dragX if dragging, otherwise use timeline position
  const clipX = isDragging && dragX !== undefined
    ? dragX
    : (clip.timelineStart * pixelsPerSecond) + xOffset;
  const clipWidth = clip.duration * pixelsPerSecond;

  // Get file name from path for text overlay
  const fileName = clip.sourceFilePath.split('/').pop() || 'Clip';

  // Calculate trim handle positions relative to source video
  const leftTrimX = clipX;
  const rightTrimX = clipX + clipWidth - HANDLE_WIDTH;

  /**
   * Handle clip body dragging (reordering on timeline)
   */
  const handleClipDragStart = (e: any) => {
    if (onDragStart) {
      onDragStart(e.target.x());
    }
  };

  const handleClipDragMove = (e: any) => {
    if (onDragMove) {
      onDragMove(e.target.x());
    }
  };

  const handleClipDragEnd = (e: any) => {
    if (onDragEnd) {
      onDragEnd();
    }
    // Reset drag position
    e.target.x(clipX);
  };

  /**
   * Handle left trim handle dragging
   */
  const handleLeftTrimDrag = (e: any) => {
    const newX = e.target.x();
    const newSourceStart = Math.max(
      0,
      Math.min(
        clip.sourceStart + (newX - leftTrimX) / pixelsPerSecond,
        clip.sourceEnd - 0.5 // Min 0.5s clip duration
      )
    );

    onTrim(newSourceStart, clip.sourceEnd);
  };

  /**
   * Handle right trim handle dragging
   */
  const handleRightTrimDrag = (e: any) => {
    const newX = e.target.x();
    const sourceMetadata = clip.sourceMetadata;
    const maxSourceEnd = sourceMetadata?.duration || clip.sourceEnd;

    const newSourceEnd = Math.max(
      clip.sourceStart + 0.5, // Min 0.5s clip duration
      Math.min(
        clip.sourceEnd + (newX - rightTrimX) / pixelsPerSecond,
        maxSourceEnd
      )
    );

    onTrim(clip.sourceStart, newSourceEnd);
  };

  // Render clip content (thumbnails or fallback)
  const renderClipContent = () => {
    const elements = [];

    // Shadow for selected clips (rendered behind)
    if (isSelected) {
      elements.push(
        <Rect
          key="shadow"
          x={clipX + 2}
          y={CLIP_Y + 2}
          width={clipWidth}
          height={CLIP_HEIGHT}
          fill="rgba(0, 0, 0, 0.3)"
          cornerRadius={4}
        />
      );
    }

    // Background rectangle (always present for borders and fallback)
    elements.push(
      <Rect
        key="background"
        x={clipX}
        y={CLIP_Y}
        width={clipWidth}
        height={CLIP_HEIGHT}
        fill="#1D3455" // Final Cut style blue-gray background
        stroke={isSelected ? CLIP_STROKE_SELECTED : CLIP_STROKE}
        strokeWidth={isSelected ? 2 : 1}
        cornerRadius={4}
        draggable
        onDragEnd={handleClipDragEnd}
        onClick={onSelect}
        onTap={onSelect}
      />
    );

    // Render thumbnails if available
    if (clip.thumbnails && clip.thumbnails.length > 0) {
      console.log(`Rendering ${clip.thumbnails.length} thumbnails for clip width ${clipWidth}px`);
      clip.thumbnails.forEach((thumbnail, index) => {
        elements.push(
          <ThumbnailImage
            key={`thumb-${index}`}
            thumbnailPath={thumbnail.path}
            clipX={clipX}
            clipY={CLIP_Y}
            clipWidth={clipWidth}
            clipHeight={CLIP_HEIGHT}
            thumbnails={clip.thumbnails!}
            index={index}
          />
        );
      });
    }

    // Loading indicator overlay
    if (clip.thumbnailsLoading) {
      elements.push(
        <Text
          key="loading"
          x={clipX + clipWidth / 2 - 40}
          y={CLIP_Y + CLIP_HEIGHT / 2 - 10}
          text="Loading..."
          fontSize={14}
          fill="white"
          fontStyle="bold"
          listening={false}
        />
      );
    }

    // Text overlay with clip name (no background)
    // For very narrow clips, truncate to single characters or hide text entirely
    let displayText = fileName;
    if (clipWidth < 30) {
      // Hide text for extremely narrow clips
      displayText = '';
    } else if (clipWidth < 60) {
      // Show only first character for narrow clips
      displayText = fileName.charAt(0);
    }

    if (displayText) {
      elements.push(
        <Text
          key="text-overlay"
          x={clipX + 6}
          y={CLIP_Y + 5}
          text={displayText}
          fontSize={13}
          fill="white"
          fontStyle="bold"
          width={clipWidth - 12}
          ellipsis={true}
          wrap="none"
          listening={false}
        />
      );
    }

    return elements;
  };

  return (
    <Group>
      {/* Clip Body with Thumbnails */}
      {renderClipContent()}

      {/* Transparent overlay to capture all clicks on the clip */}
      <Rect
        x={clipX}
        y={CLIP_Y}
        width={clipWidth}
        height={CLIP_HEIGHT}
        fill="transparent"
        onClick={onSelect}
        onTap={onSelect}
        draggable
        onDragStart={handleClipDragStart}
        onDragMove={handleClipDragMove}
        onDragEnd={handleClipDragEnd}
        opacity={isDragging ? 1 : 1}
      />

      {/* Left Trim Area - invisible with cursor change */}
      {isSelected && !isDragging && (
        <Rect
          x={leftTrimX}
          y={CLIP_Y}
          width={HANDLE_WIDTH}
          height={CLIP_HEIGHT}
          fill="transparent"
          draggable
          dragBoundFunc={(pos) => {
            // Constrain dragging to clip bounds
            return {
              x: Math.max(
                clipX - (clip.sourceStart * pixelsPerSecond),
                Math.min(pos.x, clipX + clipWidth - HANDLE_WIDTH - (0.5 * pixelsPerSecond))
              ),
              y: CLIP_Y,
            };
          }}
          onDragMove={handleLeftTrimDrag}
          onDragEnd={() => {
            // Snap back to correct position
            // (parent state update will re-render)
          }}
          onMouseEnter={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = "ew-resize";
          }}
          onMouseLeave={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = "default";
          }}
        />
      )}

      {/* Right Trim Area - invisible with cursor change */}
      {isSelected && !isDragging && (
        <Rect
          x={rightTrimX}
          y={CLIP_Y}
          width={HANDLE_WIDTH}
          height={CLIP_HEIGHT}
          fill="transparent"
          draggable
          dragBoundFunc={(pos) => {
            const sourceMetadata = clip.sourceMetadata;
            const maxSourceEnd = sourceMetadata?.duration || clip.sourceEnd;

            // Constrain dragging to clip bounds
            return {
              x: Math.max(
                clipX + (0.5 * pixelsPerSecond),
                Math.min(
                  pos.x,
                  clipX + ((maxSourceEnd - clip.sourceStart) * pixelsPerSecond) - HANDLE_WIDTH
                )
              ),
              y: CLIP_Y,
            };
          }}
          onDragMove={handleRightTrimDrag}
          onDragEnd={() => {
            // Snap back to correct position
            // (parent state update will re-render)
          }}
          onMouseEnter={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = "ew-resize";
          }}
          onMouseLeave={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = "default";
          }}
        />
      )}
    </Group>
  );
};
