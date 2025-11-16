"use client";

import { useRef, useEffect, useState, useMemo, memo } from "react";
import { Rect, Text, Group, Image as KonvaImage } from "react-konva";
import type { Clip, MediaAssetMeta } from "@/lib/editor/types";

// Global cache for Image objects by dataUrl to prevent recreating identical images
const imageCache = new Map<string, HTMLImageElement>();

interface KonvaClipItemProps {
  clip: Clip;
  asset?: MediaAssetMeta;
  isSelected: boolean;
  pixelsPerSecond: number;
  xOffset?: number;
  isDragging?: boolean;
  dragX?: number;
  onSelect: () => void;
  onDragStart?: (startX: number) => void;
  onDragMove?: (currentX: number) => void;
  onDragEnd?: () => void;
  onTrim: (newTrimStart: number, newTrimEnd: number) => void;
}

const CLIP_HEIGHT = 120;
const CLIP_Y = 94;
const HANDLE_WIDTH = 10;
const MIN_CLIP_DURATION = 0.5; // Minimum 0.5 seconds
const MIN_CLIP_WIDTH = 40; // Minimum visual width in pixels

const KonvaClipItemComponent = ({
  clip,
  asset,
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
}: KonvaClipItemProps) => {
  const dragStartXRef = useRef(0);
  const trimDragStartRef = useRef({ trimStart: 0, trimEnd: 0 });
  const [thumbnailImages, setThumbnailImages] = useState<HTMLImageElement[]>([]);

  // Load thumbnail images from data URLs with caching
  useEffect(() => {
    if (!asset?.thumbnails?.length) {
      setThumbnailImages([]);
      return;
    }

    const images: HTMLImageElement[] = [];
    let loadedCount = 0;

    asset.thumbnails.forEach((dataUrl, index) => {
      // Check if image is already in cache
      const cachedImage = imageCache.get(dataUrl);
      if (cachedImage) {
        images[index] = cachedImage;
        loadedCount++;
        if (loadedCount === asset.thumbnails!.length) {
          setThumbnailImages([...images]);
        }
        return;
      }

      // Create new image and cache it
      const img = new window.Image();
      img.onload = () => {
        imageCache.set(dataUrl, img);
        loadedCount++;
        if (loadedCount === asset.thumbnails!.length) {
          setThumbnailImages([...images]);
        }
      };
      img.src = dataUrl;
      images[index] = img;
    });

    // No cleanup needed since we're caching the images
  }, [asset?.thumbnails]);

  // Calculate clip dimensions with minimum width
  const clipWidth = Math.max(MIN_CLIP_WIDTH, clip.duration * pixelsPerSecond);
  const clipX =
    isDragging && dragX !== undefined
      ? dragX
      : clip.start * pixelsPerSecond + xOffset;

  // Memoize clip color generation based on clip ID (deterministic)
  const clipColor = useMemo(() => {
    const colors = [
      "#3B82F6", // blue
      "#8B5CF6", // purple
      "#EC4899", // pink
      "#F59E0B", // amber
      "#10B981", // green
      "#06B6D4", // cyan
    ];
    const hash = clip.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }, [clip.id]);

  // Drag handlers
  const handleDragStart = (e: any) => {
    if (!onDragStart) return;
    e.cancelBubble = true;
    dragStartXRef.current = e.target.x();
    onDragStart(clipX);
  };

  const handleDragMove = (e: any) => {
    if (!onDragMove) return;
    onDragMove(e.target.x());
  };

  const handleDragEndHandler = () => {
    if (!onDragEnd) return;
    onDragEnd();
  };

  // Trim handlers
  const handleLeftTrimDragStart = () => {
    trimDragStartRef.current = {
      trimStart: clip.trimStart,
      trimEnd: clip.trimEnd,
    };
  };

  const handleLeftTrimDragMove = (e: any) => {
    const deltaX = e.target.x() - clipX;
    const deltaTime = deltaX / pixelsPerSecond;

    // Calculate new trim start (can't exceed source boundaries)
    const newTrimStart = Math.max(
      0,
      Math.min(
        clip.trimStart + deltaTime,
        clip.trimStart + clip.duration - MIN_CLIP_DURATION,
      ),
    );

    // Update trim - this affects duration
    const trimDelta = newTrimStart - clip.trimStart;
    onTrim(trimDelta, 0);
  };

  const handleRightTrimDragStart = () => {
    trimDragStartRef.current = {
      trimStart: clip.trimStart,
      trimEnd: clip.trimEnd,
    };
  };

  const handleRightTrimDragMove = (e: any) => {
    const deltaX = e.target.x() - (clipX + clipWidth - HANDLE_WIDTH);
    const deltaTime = deltaX / pixelsPerSecond;

    // Calculate new trim end
    const newTrimEnd = Math.max(
      0,
      Math.min(
        clip.trimEnd - deltaTime,
        clip.duration - MIN_CLIP_DURATION,
      ),
    );

    // Update trim
    const trimDelta = newTrimEnd - clip.trimEnd;
    onTrim(0, trimDelta);
  };

  return (
    <Group>
      {/* Background rect (fallback color) */}
      <Rect
        x={clipX}
        y={CLIP_Y}
        width={clipWidth}
        height={CLIP_HEIGHT}
        fill={thumbnailImages.length > 0 ? "#000000" : clipColor}
        opacity={thumbnailImages.length > 0 ? 1 : 0.7}
        cornerRadius={4}
        stroke={isSelected ? "#FFFFFF" : "transparent"}
        strokeWidth={isSelected ? 3 : 0}
        shadowBlur={isSelected ? 10 : 0}
        shadowColor="rgba(255, 255, 255, 0.5)"
        onClick={onSelect}
      />

      {/* Render thumbnails if available */}
      {thumbnailImages.length > 0 && asset && (
        <>
          {thumbnailImages.map((img, index) => {
            // Calculate how many pixels each thumbnail should take
            const thumbWidth = clipWidth / thumbnailImages.length;
            const thumbX = clipX + index * thumbWidth;

            return (
              <KonvaImage
                key={index}
                image={img}
                x={thumbX}
                y={CLIP_Y}
                width={thumbWidth}
                height={CLIP_HEIGHT}
                listening={false}
              />
            );
          })}
        </>
      )}

      {/* Clip label - only show if width is sufficient */}
      {clipWidth > 60 && (
        <>
          <Text
            x={clipX + 10}
            y={CLIP_Y + 10}
            text={clip.mediaId?.substring(0, Math.floor(clipWidth / 8)) || "Clip"}
            fontSize={13}
            fontStyle="bold"
            fill="#FFFFFF"
            listening={false}
          />

          {/* Duration label */}
          <Text
            x={clipX + 10}
            y={CLIP_Y + 30}
            text={`${clip.duration.toFixed(1)}s`}
            fontSize={11}
            fill="rgba(255, 255, 255, 0.8)"
            listening={false}
          />
        </>
      )}

      {/* Draggable overlay (transparent) */}
      {!isSelected && (
        <Rect
          x={clipX}
          y={CLIP_Y}
          width={clipWidth}
          height={CLIP_HEIGHT}
          fill="transparent"
          draggable
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEndHandler}
          onMouseEnter={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = "grab";
          }}
          onMouseLeave={(e) => {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = "default";
          }}
        />
      )}

      {/* Trim handles (only when selected) */}
      {isSelected && !isDragging && (
        <>
          {/* Left trim handle */}
          <Rect
            x={clipX}
            y={CLIP_Y}
            width={HANDLE_WIDTH}
            height={CLIP_HEIGHT}
            fill="rgba(255, 255, 255, 0.2)"
            draggable
            dragBoundFunc={(pos) => ({
              x: Math.max(
                clipX,
                Math.min(pos.x, clipX + clipWidth - HANDLE_WIDTH),
              ),
              y: CLIP_Y,
            })}
            onDragStart={handleLeftTrimDragStart}
            onDragMove={handleLeftTrimDragMove}
            onMouseEnter={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = "ew-resize";
            }}
            onMouseLeave={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = "default";
            }}
          />

          {/* Right trim handle */}
          <Rect
            x={clipX + clipWidth - HANDLE_WIDTH}
            y={CLIP_Y}
            width={HANDLE_WIDTH}
            height={CLIP_HEIGHT}
            fill="rgba(255, 255, 255, 0.2)"
            draggable
            dragBoundFunc={(pos) => ({
              x: Math.max(
                clipX + HANDLE_WIDTH,
                Math.min(pos.x, clipX + clipWidth),
              ),
              y: CLIP_Y,
            })}
            onDragStart={handleRightTrimDragStart}
            onDragMove={handleRightTrimDragMove}
            onMouseEnter={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = "ew-resize";
            }}
            onMouseLeave={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = "default";
            }}
          />

          {/* Visual indicators for trim handles */}
          <Rect
            x={clipX + 2}
            y={CLIP_Y + CLIP_HEIGHT / 2 - 15}
            width={2}
            height={30}
            fill="#FFFFFF"
            listening={false}
          />
          <Rect
            x={clipX + 6}
            y={CLIP_Y + CLIP_HEIGHT / 2 - 15}
            width={2}
            height={30}
            fill="#FFFFFF"
            listening={false}
          />

          <Rect
            x={clipX + clipWidth - 8}
            y={CLIP_Y + CLIP_HEIGHT / 2 - 15}
            width={2}
            height={30}
            fill="#FFFFFF"
            listening={false}
          />
          <Rect
            x={clipX + clipWidth - 4}
            y={CLIP_Y + CLIP_HEIGHT / 2 - 15}
            width={2}
            height={30}
            fill="#FFFFFF"
            listening={false}
          />
        </>
      )}
    </Group>
  );
};

// Memoize component with custom comparison to prevent re-renders
export const KonvaClipItem = memo(KonvaClipItemComponent, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.clip.id === nextProps.clip.id &&
    prevProps.clip.start === nextProps.clip.start &&
    prevProps.clip.duration === nextProps.clip.duration &&
    prevProps.clip.trimStart === nextProps.clip.trimStart &&
    prevProps.clip.trimEnd === nextProps.clip.trimEnd &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.dragX === nextProps.dragX &&
    prevProps.pixelsPerSecond === nextProps.pixelsPerSecond &&
    prevProps.xOffset === nextProps.xOffset &&
    prevProps.asset?.thumbnails === nextProps.asset?.thumbnails
  );
});
