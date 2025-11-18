"use client";

import { useRef, useState, useEffect, useCallback, useMemo, memo } from "react";
import { Stage, Layer, Rect, Line, Text, Group } from "react-konva";
import { ChevronsDown, Plus, Video, AudioWaveform } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Sequence, Clip, MediaAssetMeta } from "@/lib/editor/types";
import { formatTime } from "@/lib/editor/utils/time-format";
import { KonvaClipItem } from "./KonvaClipItem";
import { TrackHeader } from "./TrackHeader";
import type Konva from "konva";
import { snapTimeToBeatMarkers } from "@/lib/editor/audio-beat-helpers";
import type { BeatMarker } from "@/types/audio";

interface KonvaTimelineProps {
  sequence: Sequence;
  selectedClipId: string | null;
  selectedClipIds?: string[]; // Multi-select support
  currentTime: number;
  isPlaying: boolean;
  containerWidth: number;
  containerHeight?: number;
  assets: MediaAssetMeta[];
  onClipSelect: (clipId: string) => void;
  onClipMultiSelect?: (clipIds: string[]) => void; // Multi-select callback
  onClipMove: (clipId: string, newStart: number) => void;
  onClipReorder: (clips: Clip[]) => void;
  onClipTrim: (
    clipId: string,
    newTrimStart: number,
    newTrimEnd: number,
  ) => void;
  onSeek: (time: number) => void;
  onScrub?: (time: number) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
  beatMarkers?: BeatMarker[];
  snapToBeats?: boolean;
  magneticSnapEnabled?: boolean; // Enable magnetic snapping to clip edges/playhead
  magneticSnapThreshold?: number; // Snap distance threshold in seconds (default: 0.1)
  slipSlideSensitivity?: number; // Multiplier for slip/slide drag sensitivity (default: 1.0)
  onTrackUpdate?: (trackId: string, updates: Partial<import("@/lib/editor/types").Track>) => void;
  onTrackDelete?: (trackId: string) => void;
  onTrackAdd?: (kind: "video" | "audio", name?: string) => void;
}

const CLIP_HEIGHT = 120;
const CLIP_Y = 94; // Legacy: Y position for single-track mode (kept for backward compatibility)
const TRACK_HEIGHT = 60; // Standard height for each track
const TIMELINE_HEADER_Y = 30; // Top offset for timeline markers/ruler
const TIMELINE_HEIGHT = 200;
const DEFAULT_TIMELINE_DURATION = 300; // 5 minutes default view
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4.0;
const X_OFFSET = 10; // Padding from left edge
const MIN_CLIP_WIDTH = 40; // Minimum width in pixels to prevent slivers
const AUDIO_TRACK_HEIGHT = 60;
const AUDIO_TRACK_GAP = 30;
const AUDIO_CLIP_COLOR = "#4F46E5";
const AUDIO_TRACK_LABEL_COLOR = "#9CA3AF";
const AUDIO_TRACK_BG = "#0b0b0b";
const AUDIO_WAVEFORM_COLOR = "#A5B4FC";
const AUDIO_VOLUME_COLOR = "#FBBF24";
const AUDIO_TRACK_Y = CLIP_Y + CLIP_HEIGHT + 20; // Legacy: Y position for audio track in single-track mode
const MAX_TRACKS = 20; // Maximum number of tracks allowed

const generateWaveformPoints = (
  waveform: Float32Array,
  xStart: number,
  yCenter: number,
  width: number,
  height: number,
): number[] => {
  const points: number[] = [];
  if (!Number.isFinite(width) || width <= 0) return points;

  const samples = waveform.length;
  if (!samples) return points;

  const steps = Math.max(1, Math.floor(width));
  const halfHeight = height / 2;

  for (let i = 0; i < steps; i++) {
    const ratio = i / steps;
    const sampleIndex = Math.min(
      Math.floor(ratio * samples),
      Math.max(0, samples - 1),
    );
    const amplitude = waveform[sampleIndex] || 0;
    const x = xStart + i;
    const y = yCenter - amplitude * halfHeight;
    points.push(x, y);
  }

  return points;
};

const KonvaTimelineComponent = ({
  sequence,
  selectedClipId,
  selectedClipIds = [],
  currentTime,
  containerWidth,
  containerHeight = TIMELINE_HEIGHT,
  assets,
  onClipSelect,
  onClipMultiSelect,
  onClipMove,
  onClipReorder,
  onClipTrim,
  onSeek,
  onScrub,
  onScrubStart,
  onScrubEnd,
  beatMarkers = [],
  snapToBeats = false,
  magneticSnapEnabled = true,
  magneticSnapThreshold = 0.1, // Default 100ms snap threshold
  slipSlideSensitivity = 1.0, // Default sensitivity multiplier
  onTrackUpdate,
  onTrackDelete,
  onTrackAdd,
}: KonvaTimelineProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackHeadersContainerRef = useRef<HTMLDivElement>(null);
  const timelineCanvasContainerRef = useRef<HTMLDivElement>(null);
  const playheadLineRef = useRef<Konva.Line>(null);
  const playheadChevronRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [scrollY, setScrollY] = useState<number>(0);
  const [scrubberTime, setScrubberTime] = useState(0);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [draggedClipX, setDraggedClipX] = useState<number>(0);
  const [virtualClipOrder, setVirtualClipOrder] = useState<Clip[]>([]);
  const [snapGuides, setSnapGuides] = useState<number[]>([]); // Array of time positions for snap guides
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  // Track drag-to-reorder state
  const [draggingTrackId, setDraggingTrackId] = useState<string | null>(null);
  const [dragStartY, setDragStartY] = useState<number>(0);
  const [dragCurrentY, setDragCurrentY] = useState<number>(0);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  // Marquee selection state
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);

  // Editing mode state machine: normal, slip, slide
  const [editingMode, setEditingMode] = useState<'normal' | 'slip' | 'slide'>('normal');
  const [slipInitialTrimStart, setSlipInitialTrimStart] = useState<number>(0); // Store initial trimStart for slip mode

  const scrubRafRef = useRef<number | null>(null);
  const pendingScrubTimeRef = useRef<number | null>(null);
  const isScrubbing = useRef(false);

  // Ref to track current selection state (prevents stale closures)
  const selectedClipIdsRef = useRef<string[]>(selectedClipIds);

  // Keep ref in sync with prop
  useEffect(() => {
    selectedClipIdsRef.current = selectedClipIds;
  }, [selectedClipIds]);

  // Listen for Alt key release to exit slip/slide mode mid-drag
  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && editingMode !== 'normal' && draggingClipId) {
        setEditingMode('normal');
      }
    };
    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, [editingMode, draggingClipId]);

  // Sort tracks by order for consistent rendering
  const sortedTracks = useMemo(
    () => [...sequence.tracks].sort((a, b) => a.order - b.order),
    [sequence.tracks]
  );

  // Helper function to get Y position for a track based on its order
  const getTrackY = useCallback((trackOrder: number) => {
    return TIMELINE_HEADER_Y + trackOrder * TRACK_HEIGHT;
  }, []);

  // Virtual rendering: Calculate visible tracks based on scroll position
  const VIEWPORT_BUFFER = 2; // Render 2 extra tracks above/below viewport for smooth scrolling

  const getVisibleTracks = useCallback(() => {
    // Calculate how many tracks fit in the viewport
    const visibleTrackCount = Math.ceil(containerHeight / TRACK_HEIGHT);

    // Calculate which tracks are currently visible based on scroll position
    const startIndex = Math.max(0, Math.floor(scrollY / TRACK_HEIGHT) - VIEWPORT_BUFFER);
    const endIndex = Math.min(
      sortedTracks.length,
      startIndex + visibleTrackCount + (VIEWPORT_BUFFER * 2)
    );

    return {
      visibleTracks: sortedTracks.slice(startIndex, endIndex),
      startIndex,
      endIndex,
      visibleTrackCount
    };
  }, [sortedTracks, scrollY, containerHeight]);

  // Helper function to find track by clip ID
  const findTrackByClipId = useCallback(
    (clipId: string) => {
      return sortedTracks.find((track) =>
        track.clips.some((clip) => clip.id === clipId)
      );
    },
    [sortedTracks]
  );

  // Legacy support: Get first video/audio track (for backward compatibility)
  const videoTrack = sequence.tracks.find((t) => t.kind === "video");
  const audioTrack = sequence.tracks.find((t) => t.kind === "audio");
  const clips = videoTrack?.clips ?? [];
  const audioClips = audioTrack?.clips ?? [];
  const hasAudioTrack = audioClips.length > 0;
  const snapEnabled = snapToBeats && beatMarkers.length > 0;

  // Helper to check if a clip is selected (either in single or multi mode)
  const isClipSelected = useCallback(
    (clipId: string) => {
      if (selectedClipIds.length > 0) {
        return selectedClipIds.includes(clipId);
      }
      return clipId === selectedClipId;
    },
    [selectedClipId, selectedClipIds],
  );

  // Create asset lookup Map for O(1) access instead of O(n) find
  const assetMap = useMemo(() => {
    const map = new Map<string, MediaAssetMeta>();
    assets.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [assets]);

  // Calculate effective duration
  const effectiveDuration = Math.max(
    sequence.duration || DEFAULT_TIMELINE_DURATION,
    DEFAULT_TIMELINE_DURATION,
  );
  const visibleBeatMarkers = useMemo(
    () =>
      beatMarkers.filter(
        (marker) => marker.time >= 0 && marker.time <= effectiveDuration + 1,
      ),
    [beatMarkers, effectiveDuration],
  );

  // Smart default zoom based on content duration
  const calculateSmartZoom = useCallback(() => {
    if (sequence.duration <= 0) return 1.0;

    // Target: fill 70% of screen with actual content
    const targetViewDuration = sequence.duration / 0.7;
    const basePixelsPerSecond = containerWidth / DEFAULT_TIMELINE_DURATION;
    const smartZoom = containerWidth / targetViewDuration / basePixelsPerSecond;

    // Clamp between min and max zoom
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, smartZoom));
  }, [sequence.duration, containerWidth]);

  const [zoomLevel, setZoomLevel] = useState(() => calculateSmartZoom());

  // Update zoom when sequence duration changes
  useEffect(() => {
    setZoomLevel(calculateSmartZoom());
  }, [calculateSmartZoom]);

  // Dynamic pixels per second based on zoom
  const PIXELS_PER_SECOND =
    (containerWidth / DEFAULT_TIMELINE_DURATION) * zoomLevel;
  const TIMELINE_WIDTH = effectiveDuration * PIXELS_PER_SECOND + 50;
  const timelineHeight =
    containerHeight + (hasAudioTrack ? AUDIO_TRACK_HEIGHT + AUDIO_TRACK_GAP : 0);
  const snapTime = useCallback(
    (value: number) =>
      snapEnabled ? snapTimeToBeatMarkers(value, beatMarkers) : value,
    [snapEnabled, beatMarkers],
  );

  // Time <-> Pixel conversion
  const timeToPixels = useCallback(
    (time: number) => time * PIXELS_PER_SECOND,
    [PIXELS_PER_SECOND],
  );
  const pixelsToTime = useCallback(
    (pixels: number) => pixels / PIXELS_PER_SECOND,
    [PIXELS_PER_SECOND],
  );

  // Update playhead position directly via ref to avoid 60fps re-renders
  // Use RAF to throttle updates and prevent excessive canvas redraws
  useEffect(() => {
    let rafId: number;

    const updatePlayhead = () => {
      if (playheadLineRef.current) {
        const xPos = timeToPixels(currentTime) + X_OFFSET;
        playheadLineRef.current.points([xPos, 0, xPos, timelineHeight]);
        playheadLineRef.current.getLayer()?.batchDraw();
      }

      // Update HTML chevron position
      if (playheadChevronRef.current) {
        const xPos = timeToPixels(currentTime) + X_OFFSET;
        playheadChevronRef.current.style.left = `${xPos}px`;
      }
    };

    rafId = requestAnimationFrame(updatePlayhead);
    return () => cancelAnimationFrame(rafId);
  }, [currentTime, timeToPixels, timelineHeight]);

  // Zoom with Ctrl/Cmd + scroll wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const scrollLeft = containerRef.current.scrollLeft;

      const timeUnderCursor = pixelsToTime(mouseX + scrollLeft);

      const zoomDelta = -e.deltaY * 0.003;
      const newZoomLevel = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, zoomLevel + zoomDelta),
      );

      if (newZoomLevel !== zoomLevel) {
        setZoomLevel(newZoomLevel);

        requestAnimationFrame(() => {
          if (!containerRef.current) return;
          const newPixelsPerSecond =
            (containerWidth / DEFAULT_TIMELINE_DURATION) * newZoomLevel;
          const newPixelPosition = timeUnderCursor * newPixelsPerSecond;
          const newScrollLeft = newPixelPosition - mouseX;
          containerRef.current.scrollLeft = Math.max(0, newScrollLeft);
        });
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }
  }, [zoomLevel, containerWidth, pixelsToTime]);

  // Synchronized scrolling between track headers and timeline canvas
  useEffect(() => {
    const trackHeadersContainer = trackHeadersContainerRef.current;
    const timelineCanvasContainer = timelineCanvasContainerRef.current;

    if (!trackHeadersContainer || !timelineCanvasContainer) return;

    const handleHeadersScroll = () => {
      const scrollTop = trackHeadersContainer.scrollTop;
      setScrollY(scrollTop);
      if (timelineCanvasContainer.scrollTop !== scrollTop) {
        timelineCanvasContainer.scrollTop = scrollTop;
      }
    };

    const handleCanvasScroll = () => {
      const scrollTop = timelineCanvasContainer.scrollTop;
      setScrollY(scrollTop);
      if (trackHeadersContainer.scrollTop !== scrollTop) {
        trackHeadersContainer.scrollTop = scrollTop;
      }
    };

    trackHeadersContainer.addEventListener('scroll', handleHeadersScroll);
    timelineCanvasContainer.addEventListener('scroll', handleCanvasScroll);

    return () => {
      trackHeadersContainer.removeEventListener('scroll', handleHeadersScroll);
      timelineCanvasContainer.removeEventListener('scroll', handleCanvasScroll);
    };
  }, []);

  // Keyboard shortcuts (Cmd/Ctrl+A for select all, PageUp/PageDown for scrolling)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+A: Select all clips
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        if (onClipMultiSelect && clips.length > 0) {
          const allClipIds = clips.map((c) => c.id);
          onClipMultiSelect(allClipIds);
        }
        return;
      }

      // PageDown: Scroll down by one viewport height
      if (e.key === "PageDown") {
        e.preventDefault();
        if (trackHeadersContainerRef.current) {
          trackHeadersContainerRef.current.scrollTop += containerHeight;
        }
        return;
      }

      // PageUp: Scroll up by one viewport height
      if (e.key === "PageUp") {
        e.preventDefault();
        if (trackHeadersContainerRef.current) {
          trackHeadersContainerRef.current.scrollTop -= containerHeight;
        }
        return;
      }

      // Ctrl/Cmd+Home: Scroll to top
      if ((e.metaKey || e.ctrlKey) && e.key === "Home") {
        e.preventDefault();
        if (trackHeadersContainerRef.current) {
          trackHeadersContainerRef.current.scrollTop = 0;
        }
        return;
      }

      // Ctrl/Cmd+End: Scroll to bottom
      if ((e.metaKey || e.ctrlKey) && e.key === "End") {
        e.preventDefault();
        if (trackHeadersContainerRef.current) {
          const maxScroll = trackHeadersContainerRef.current.scrollHeight - trackHeadersContainerRef.current.clientHeight;
          trackHeadersContainerRef.current.scrollTop = maxScroll;
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clips, onClipMultiSelect, containerHeight]);

  // Handle timeline click for seeking and deselection
  const handleTimelineClick = (e: any) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const pointerPosition = stage.getPointerPosition();
    if (pointerPosition) {
      const clickedTime = pixelsToTime(pointerPosition.x - X_OFFSET);
      const clampedTime = Math.max(0, Math.min(effectiveDuration, clickedTime));
      const snappedTime = snapTime(clampedTime);
      onSeek(snappedTime);

      // Deselect all clips on background click (unless shift or cmd/ctrl is held)
      if (!e.evt.shiftKey && !(e.evt.metaKey || e.evt.ctrlKey) && onClipMultiSelect) {
        onClipMultiSelect([]);
      }
    }
  };

  // Handle timeline mouse move for scrubbing
  const handleTimelineMouseMove = (e: any) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const pointerPosition = stage.getPointerPosition();
    if (pointerPosition) {
      const hoveredTime = pixelsToTime(pointerPosition.x - X_OFFSET);
      const clampedTime = Math.max(0, Math.min(effectiveDuration, hoveredTime));
      const snappedTime = snapTime(clampedTime);

      setScrubberTime(snappedTime);
      setIsHovering(true);

      // Signal scrub start on first hover
      if (!isScrubbing.current && onScrubStart) {
        isScrubbing.current = true;
        onScrubStart();
      }

      // Throttle scrub calls using requestAnimationFrame
      if (onScrub) {
        pendingScrubTimeRef.current = snappedTime;

        if (scrubRafRef.current === null) {
          scrubRafRef.current = requestAnimationFrame(() => {
            if (pendingScrubTimeRef.current !== null) {
              onScrub(pendingScrubTimeRef.current);
              pendingScrubTimeRef.current = null;
            }
            scrubRafRef.current = null;
          });
        }
      }
    }
  };

  const handleTimelineMouseLeave = () => {
    setIsHovering(false);

    // Signal scrub end
    if (isScrubbing.current && onScrubEnd) {
      isScrubbing.current = false;
      onScrubEnd();
    }

    // Cancel any pending scrub on mouse leave
    if (scrubRafRef.current !== null) {
      cancelAnimationFrame(scrubRafRef.current);
      scrubRafRef.current = null;
      pendingScrubTimeRef.current = null;
    }
  };

  // Marquee selection handlers
  const handleStageMouseDown = useCallback(
    (e: any) => {
      // Only start marquee on background click (not on clips)
      const target = e.target;
      if (target === e.target.getStage() || target.attrs.id === "timeline-background") {
        const stage = e.target.getStage();
        const pointerPosition = stage.getPointerPosition();
        if (pointerPosition) {
          setMarqueeStart({ x: pointerPosition.x, y: pointerPosition.y });
          setMarqueeCurrent({ x: pointerPosition.x, y: pointerPosition.y });
          setIsMarqueeSelecting(true);
        }
      }
    },
    [],
  );

  const handleStageMouseMove = useCallback(
    (e: any) => {
      if (!isMarqueeSelecting || !marqueeStart) return;

      const stage = e.target.getStage();
      const pointerPosition = stage.getPointerPosition();
      if (pointerPosition) {
        setMarqueeCurrent({ x: pointerPosition.x, y: pointerPosition.y });
      }
    },
    [isMarqueeSelecting, marqueeStart],
  );

  const handleStageMouseUp = useCallback(
    (e: any) => {
      if (!isMarqueeSelecting || !marqueeStart || !marqueeCurrent) {
        setIsMarqueeSelecting(false);
        setMarqueeStart(null);
        setMarqueeCurrent(null);
        return;
      }

      // Calculate marquee bounds
      const x1 = Math.min(marqueeStart.x, marqueeCurrent.x);
      const x2 = Math.max(marqueeStart.x, marqueeCurrent.x);
      const y1 = Math.min(marqueeStart.y, marqueeCurrent.y);
      const y2 = Math.max(marqueeStart.y, marqueeCurrent.y);

      // Find clips that intersect with marquee (check all tracks)
      const selectedIds: string[] = [];
      sortedTracks.forEach((track) => {
        const trackY = getTrackY(track.order);
        track.clips.forEach((clip) => {
          const clipX = timeToPixels(clip.start) + X_OFFSET;
          const clipWidth = clip.duration * PIXELS_PER_SECOND;
          const clipY = trackY;
          const clipHeight = TRACK_HEIGHT;

          // Check if clip intersects with marquee rectangle
          const intersects =
            clipX < x2 &&
            clipX + clipWidth > x1 &&
            clipY < y2 &&
            clipY + clipHeight > y1;

          if (intersects) {
            selectedIds.push(clip.id);
          }
        });
      });

      // Update selection
      if (onClipMultiSelect && selectedIds.length > 0) {
        if (e.evt.shiftKey) {
          // Shift+marquee: add to existing selection (use ref for current state)
          const currentSelection = selectedClipIdsRef.current;
          const combined = [...new Set([...currentSelection, ...selectedIds])];
          onClipMultiSelect(combined);
        } else {
          // Regular marquee: replace selection
          onClipMultiSelect(selectedIds);
        }
      }

      // Clear marquee state
      setIsMarqueeSelecting(false);
      setMarqueeStart(null);
      setMarqueeCurrent(null);
    },
    [
      isMarqueeSelecting,
      marqueeStart,
      marqueeCurrent,
      clips,
      timeToPixels,
      PIXELS_PER_SECOND,
      onClipMultiSelect,
    ],
  );

  // Handle clip selection with shift-click and cmd/ctrl-click support
  const handleClipClick = useCallback(
    (clipId: string, shiftKey: boolean, metaKey: boolean) => {
      if (!onClipMultiSelect) {
        // Fallback to single selection if multi-select not supported
        onClipSelect(clipId);
        return;
      }

      // Use ref to get current selection state (prevents stale closures)
      const currentSelection = selectedClipIdsRef.current;

      if (shiftKey && currentSelection.length > 0) {
        // Shift-click: range selection between last selected clip and clicked clip
        const lastSelectedId = currentSelection[currentSelection.length - 1];
        const clickedIndex = clips.findIndex((c) => c.id === clipId);
        const lastSelectedIndex = clips.findIndex((c) => c.id === lastSelectedId);

        if (clickedIndex !== -1 && lastSelectedIndex !== -1) {
          // Select all clips in the range (inclusive)
          const startIndex = Math.min(clickedIndex, lastSelectedIndex);
          const endIndex = Math.max(clickedIndex, lastSelectedIndex);
          const rangeIds = clips.slice(startIndex, endIndex + 1).map((c) => c.id);

          // Merge with existing selection (preserve clips outside the range)
          const newSelection = [...new Set([...currentSelection, ...rangeIds])];
          onClipMultiSelect(newSelection);
        }
      } else if (metaKey) {
        // Cmd/Ctrl-click: toggle individual clip in multi-selection
        if (currentSelection.includes(clipId)) {
          // Remove from selection (allow empty selection)
          const newSelection = currentSelection.filter((id) => id !== clipId);
          onClipMultiSelect(newSelection);
        } else {
          // Add to selection
          onClipMultiSelect([...currentSelection, clipId]);
        }
      } else {
        // Regular click: single selection
        onClipMultiSelect([clipId]);
      }
    },
    [onClipMultiSelect, clips],
  );

  // Calculate snap points for magnetic snapping
  const calculateSnapPoints = useCallback(
    (draggedClipId: string, draggedClipTime: number, draggedClipDuration: number) => {
      if (!magneticSnapEnabled) {
        setSnapGuides([]);
        return draggedClipTime;
      }

      const snapPoints: Array<{ time: number; type: string }> = [];

      // Add playhead as snap point
      snapPoints.push({ time: currentTime, type: "playhead" });

      // Add all other clip edges as snap points
      clips.forEach((clip) => {
        if (clip.id === draggedClipId) return; // Skip the dragged clip

        // Clip start
        snapPoints.push({ time: clip.start, type: "clip-start" });
        // Clip end
        snapPoints.push({ time: clip.start + clip.duration, type: "clip-end" });
      });

      // Check both start and end of dragged clip for snapping
      const draggedStart = draggedClipTime;
      const draggedEnd = draggedClipTime + draggedClipDuration;

      let bestSnapPoint: { time: number; offset: number } | null = null;
      let minDistance = magneticSnapThreshold;

      for (const snapPoint of snapPoints) {
        // Check if dragged clip START is close to snap point
        const distanceToStart = Math.abs(draggedStart - snapPoint.time);
        if (distanceToStart < minDistance) {
          minDistance = distanceToStart;
          bestSnapPoint = { time: snapPoint.time, offset: 0 }; // Snap start to point
        }

        // Check if dragged clip END is close to snap point
        const distanceToEnd = Math.abs(draggedEnd - snapPoint.time);
        if (distanceToEnd < minDistance) {
          minDistance = distanceToEnd;
          bestSnapPoint = { time: snapPoint.time, offset: -draggedClipDuration }; // Snap end to point
        }
      }

      if (bestSnapPoint) {
        // Show snap guide at the snap point
        setSnapGuides([bestSnapPoint.time]);
        // Return snapped time
        return bestSnapPoint.time + bestSnapPoint.offset;
      }

      // No snap, clear guides
      setSnapGuides([]);
      return draggedClipTime;
    },
    [magneticSnapEnabled, magneticSnapThreshold, currentTime, clips],
  );

  // Clip drag handlers - memoized to prevent child re-renders
  const handleClipDragStart = useCallback(
    (clipId: string, startX: number, altKey: boolean, metaKey: boolean) => {
      const clip = clips.find((c) => c.id === clipId);
      
      // Check if clip's track is locked
      const track = findTrackByClipId(clipId);
      if (track?.locked) {
        console.warn(`Cannot drag clip on locked track: ${track.name}`);
        return;
      }

      // Set editing mode based on keyboard modifiers
      if (altKey && metaKey) {
        setEditingMode('slide'); // Cmd+Alt+drag = slide mode
      } else if (altKey) {
        setEditingMode('slip'); // Alt+drag = slip mode
        // Store initial trimStart for slip mode calculations
        if (clip) {
          setSlipInitialTrimStart(clip.trimStart);
        }
      } else {
        setEditingMode('normal'); // Normal drag
      }

      setDraggingClipId(clipId);
      setDraggedClipX(startX);
      setVirtualClipOrder((prev) => [...clips]);
    },
    [clips, findTrackByClipId],
  );

  const handleClipDragMove = useCallback(
    (clipId: string, currentX: number) => {
      const draggedClip = clips.find((c) => c.id === clipId);
      if (!draggedClip) return;

      // SLIP MODE: Adjust content offset without moving clip position
      if (editingMode === 'slip') {
        // Calculate drag delta in pixels and convert to time
        const dragDeltaPixels = currentX - draggedClipX;
        const dragDeltaTime = (dragDeltaPixels / PIXELS_PER_SECOND) * slipSlideSensitivity;

        // Calculate new trimStart based on initial value and drag delta
        // Dragging right should shift content left (decrease trimStart)
        // Dragging left should shift content right (increase trimStart)
        const newTrimStart = slipInitialTrimStart - dragDeltaTime;

        // Get source media duration to enforce bounds
        const asset = assets.find((a) => a.id === draggedClip.mediaId);
        const sourceDuration = asset?.duration ?? draggedClip.duration + draggedClip.trimStart + draggedClip.trimEnd;

        // Enforce bounds: trimStart must be >= 0 and trimStart + duration <= sourceDuration
        const minTrimStart = 0;
        const maxTrimStart = sourceDuration - draggedClip.duration;
        const clampedTrimStart = Math.max(minTrimStart, Math.min(newTrimStart, maxTrimStart));

        // Update trimEnd to maintain clip duration
        const newTrimEnd = sourceDuration - (clampedTrimStart + draggedClip.duration);

        // Call onClipTrim to update the clip
        onClipTrim(clipId, clampedTrimStart, newTrimEnd);
        return;
      }

      // SLIDE MODE: Move clip while shifting adjacent clips to preserve gaps
      if (editingMode === 'slide') {
        // Calculate drag delta from initial drag position
        const dragDeltaPixels = currentX - draggedClipX;
        const dragDeltaTime = (dragDeltaPixels / PIXELS_PER_SECOND) * slipSlideSensitivity;

        // Find the dragged clip's index in the original clip order
        const draggedClipIndex = clips.findIndex((c) => c.id === clipId);
        if (draggedClipIndex === -1) return;

        // Calculate new position for dragged clip (constrain to timeline bounds)
        const newStart = Math.max(0, draggedClip.start + dragDeltaTime);

        // Create a new clip array with clips shifted to maintain gaps
        // When dragging right: shift all clips AFTER dragged clip
        // When dragging left: shift all clips BEFORE dragged clip
        const updatedClips = clips.map((clip, index) => {
          if (clip.id === clipId) {
            // Move the dragged clip
            return { ...clip, start: newStart };
          } else if (dragDeltaTime > 0 && index > draggedClipIndex) {
            // Dragging right: shift clips after by the same delta
            return { ...clip, start: Math.max(0, clip.start + dragDeltaTime) };
          } else if (dragDeltaTime < 0 && index < draggedClipIndex) {
            // Dragging left: shift clips before by the same delta
            return { ...clip, start: Math.max(0, clip.start + dragDeltaTime) };
          }
          // Clips on the opposite side of drag direction remain unchanged
          return clip;
        });

        // Update virtual clip order for real-time preview
        setVirtualClipOrder(updatedClips);
        setDraggedClipX(currentX);
        return;
      }

      // NORMAL MODE: Standard clip repositioning and reordering
      // Convert pixel position to time
      const dragTime = pixelsToTime(currentX);

      // Apply snap logic if enabled
      const snappedTime = calculateSnapPoints(
        clipId,
        dragTime,
        draggedClip.duration
      );

      // Convert back to pixels for rendering
      const snappedX = timeToPixels(snappedTime);
      setDraggedClipX(snappedX);

      setVirtualClipOrder((prevOrder) => {
        const draggedClip = prevOrder.find((c) => c.id === clipId);
        if (!draggedClip) return prevOrder;

        const draggedClipCenter =
          currentX + (draggedClip.duration * PIXELS_PER_SECOND) / 2;
        const otherClips = prevOrder.filter((c) => c.id !== clipId);
        const newOrder = [...otherClips];

        let insertIndex = 0;
        let cumulativeTime = 0;

        for (let i = 0; i < otherClips.length; i++) {
          const clip = otherClips[i];
          const clipStart = cumulativeTime * PIXELS_PER_SECOND;
          const clipEnd = clipStart + clip.duration * PIXELS_PER_SECOND;
          const clipCenter = (clipStart + clipEnd) / 2;

          if (draggedClipCenter > clipCenter) {
            insertIndex = i + 1;
          }

          cumulativeTime += clip.duration;
        }

        newOrder.splice(insertIndex, 0, draggedClip);
        return newOrder;
      });
    },
    [PIXELS_PER_SECOND, clips, pixelsToTime, timeToPixels, calculateSnapPoints, editingMode, draggedClipX, slipInitialTrimStart, assets, onClipTrim],
  );

  const handleClipDragEnd = useCallback(
    (clipId: string) => {
      // Calculate reordered clips outside of setState
      let reorderedClips: Clip[] = [];
      setVirtualClipOrder((prevOrder) => {
        if (!draggingClipId) return prevOrder;

        // Reflow clips to be sequential
        let cumulativeTime = 0;
        reorderedClips = prevOrder.map((clip) => {
          const reflowedClip = { ...clip, start: cumulativeTime };
          cumulativeTime += clip.duration;
          return reflowedClip;
        });

        return prevOrder;
      });

      // Call onClipReorder outside of setState to avoid update-during-render error
      if (reorderedClips.length > 0) {
        onClipReorder(reorderedClips);
      }

      setDraggingClipId(null);
      setDraggedClipX(0);
      setVirtualClipOrder([]);
      setSnapGuides([]); // Clear snap guides when drag ends
      setEditingMode('normal'); // Reset editing mode when drag ends
    },
    [draggingClipId, onClipReorder],
  );

  // Handle adding a new track
  const handleAddTrack = useCallback(
    (kind: "video" | "audio") => {
      if (sortedTracks.length >= MAX_TRACKS) {
        console.warn(`Maximum tracks reached: ${MAX_TRACKS}`);
        return;
      }

      if (onTrackAdd) {
        onTrackAdd(kind);
        // Auto-scroll to new track (would need a ref to the track headers container)
        // For now, the track will appear at the bottom
      }
    },
    [sortedTracks.length, onTrackAdd]
  );

  // Handle track drag-to-reorder
  const handleTrackDragStart = useCallback(
    (trackId: string, startY: number) => {
      const track = sortedTracks.find((t) => t.id === trackId);
      if (!track || track.locked) return;

      setDraggingTrackId(trackId);
      setDragStartY(startY);
      setDragCurrentY(startY);
    },
    [sortedTracks]
  );

  const handleTrackDragMove = useCallback(
    (currentY: number) => {
      if (!draggingTrackId) return;

      setDragCurrentY(currentY);

      // Calculate which track index the drag is over
      const dragDelta = currentY - dragStartY;
      const draggedTrack = sortedTracks.find((t) => t.id === draggingTrackId);
      if (!draggedTrack) return;

      // Calculate drop target index based on mouse Y position
      const trackIndex = Math.floor((currentY - dragStartY) / TRACK_HEIGHT + draggedTrack.order);
      const clampedIndex = Math.max(0, Math.min(sortedTracks.length - 1, trackIndex));

      setDropTargetIndex(clampedIndex);
    },
    [draggingTrackId, dragStartY, sortedTracks]
  );

  const handleTrackDragEnd = useCallback(() => {
    if (!draggingTrackId || dropTargetIndex === null || !onTrackUpdate) {
      setDraggingTrackId(null);
      setDragStartY(0);
      setDragCurrentY(0);
      setDropTargetIndex(null);
      return;
    }

    const draggedTrack = sortedTracks.find((t) => t.id === draggingTrackId);
    if (!draggedTrack || draggedTrack.order === dropTargetIndex) {
      // No change needed
      setDraggingTrackId(null);
      setDragStartY(0);
      setDragCurrentY(0);
      setDropTargetIndex(null);
      return;
    }

    // Reorder tracks by updating their order properties
    const updatedTracks = [...sortedTracks];
    const oldIndex = draggedTrack.order;
    const newIndex = dropTargetIndex;

    // Remove dragged track
    const [movedTrack] = updatedTracks.splice(oldIndex, 1);
    // Insert at new position
    updatedTracks.splice(newIndex, 0, movedTrack);

    // Update all track orders
    updatedTracks.forEach((track, index) => {
      if (track.order !== index) {
        onTrackUpdate(track.id, { order: index });
      }
    });

    // Clear drag state
    setDraggingTrackId(null);
    setDragStartY(0);
    setDragCurrentY(0);
    setDropTargetIndex(null);
  }, [draggingTrackId, dropTargetIndex, sortedTracks, onTrackUpdate]);

  // Render clips
  const clipsToRender = draggingClipId ? virtualClipOrder : clips;

  // Get visible tracks for virtual rendering
  const { visibleTracks, startIndex: visibleStartIndex } = getVisibleTracks();

  return (
    <div className="relative w-full h-full flex flex-col border-t border-border bg-background">
      {/* Time ruler */}
      <div className="flex-none h-8 bg-muted/30 border-b border-border relative flex">
        {/* Left spacer for track headers */}
        <div className="w-[200px] flex-shrink-0 border-r border-border" />
        
        {/* Ruler content */}
        <div className="flex-1 overflow-x-auto scrollbar-hide relative">
        <div style={{ width: `${TIMELINE_WIDTH}px`, height: "100%" }}>
          {(() => {
            // Adaptive marker interval based on zoom and duration
            const getMarkerInterval = () => {
              const visibleDuration = containerWidth / PIXELS_PER_SECOND;

              if (visibleDuration <= 30) return 1; // 1s for very zoomed in
              if (visibleDuration <= 60) return 5; // 5s for medium zoom
              if (visibleDuration <= 180) return 10; // 10s for normal
              if (visibleDuration <= 600) return 30; // 30s for zoomed out
              return 60; // 60s for very zoomed out
            };

            const interval = getMarkerInterval();
            const markers = [];

            for (let time = 0; time <= effectiveDuration; time += interval) {
              const x = timeToPixels(time) + X_OFFSET;
              markers.push(
                <div
                  key={time}
                  className="absolute text-xs text-muted-foreground"
                  style={{ left: `${x}px`, top: "2px" }}
                >
                  {formatTime(time)}
                </div>,
              );
            }

            return markers;
          })()}

          {/* Playhead chevron indicator */}
          <div
            ref={playheadChevronRef}
            className="absolute pointer-events-none"
            style={{
              left: `${timeToPixels(currentTime) + X_OFFSET}px`,
              bottom: "0px",
              transform: "translateX(-50%)",
            }}
          >
            <ChevronsDown className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
        </div>
        </div>
      </div>

      {/* Canvas timeline with track headers */}
      <div className="flex-1 flex" style={{ height: `${timelineHeight}px` }}>
        {/* Track Headers Column */}
        <div className="w-[200px] flex-shrink-0 border-r border-border flex flex-col bg-zinc-900">
          <div
            ref={trackHeadersContainerRef}
            className="flex-1 overflow-y-auto relative scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900"
            style={{ maxHeight: `${containerHeight}px` }}
          >
            {sortedTracks.map((track, index) => (
              <div key={track.id} className="relative">
                {/* Drop zone indicator - show above track when hovering */}
                {dropTargetIndex === index && draggingTrackId !== track.id && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-10" />
                )}

                <TrackHeader
                  track={track}
                  onTrackUpdate={onTrackUpdate || (() => {})}
                  onTrackDelete={onTrackDelete || (() => {})}
                  isSelected={selectedTrackId === track.id}
                  onSelect={setSelectedTrackId}
                  onDragStart={handleTrackDragStart}
                  onDragMove={handleTrackDragMove}
                  onDragEnd={handleTrackDragEnd}
                  isDragging={draggingTrackId === track.id}
                />
              </div>
            ))}
          </div>
          
          {/* Add Track Button */}
          {onTrackAdd && (
            <div className="p-2 border-t border-border bg-zinc-900">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={sortedTracks.length >= MAX_TRACKS}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Track
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[180px]">
                  <DropdownMenuItem onClick={() => handleAddTrack("video")}>
                    <Video className="w-4 h-4 mr-2" />
                    Video Track
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddTrack("audio")}>
                    <AudioWaveform className="w-4 h-4 mr-2" />
                    Audio Track
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Timeline Canvas */}
        <div
          ref={containerRef}
          className="overflow-x-auto overflow-y-hidden flex-1"
          style={{
            cursor: editingMode === 'slip' ? 'ew-resize' :
                    editingMode === 'slide' ? 'move' :
                    draggingClipId ? 'grabbing' : 'default'
          }}
        >
        <div
          ref={timelineCanvasContainerRef}
          className="overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900"
          style={{ maxHeight: `${containerHeight}px` }}
        >
        <Stage
          key="konva-timeline-stage"
          width={TIMELINE_WIDTH}
          height={timelineHeight}
          onMouseMove={(e) => {
            handleTimelineMouseMove(e);
            handleStageMouseMove(e);
          }}
          onMouseLeave={handleTimelineMouseLeave}
          onMouseDown={handleStageMouseDown}
          onMouseUp={handleStageMouseUp}
        >
          <Layer>
            {/* Background */}
            <Rect
              id="timeline-background"
              x={0}
              y={0}
              width={TIMELINE_WIDTH}
              height={timelineHeight}
              fill="#1a1a1a"
              onClick={handleTimelineClick}
            />

            {/* Zebra striping for tracks - only render visible tracks */}
            {visibleTracks.map((track, index) => {
              const trackY = getTrackY(track.order);
              const globalIndex = track.order; // Use global order for alternating pattern
              const isEven = globalIndex % 2 === 0;
              const stripeFill = isEven ? "#111827" : "#0f172a"; // Dark mode colors

              return (
                <Rect
                  key={`zebra-${track.id}`}
                  x={0}
                  y={trackY}
                  width={TIMELINE_WIDTH}
                  height={TRACK_HEIGHT}
                  fill={stripeFill}
                  listening={false}
                />
              );
            })}
            
            {/* Track selection highlight */}
            {selectedTrackId && sortedTracks.find(t => t.id === selectedTrackId) && (() => {
              const selectedTrack = sortedTracks.find(t => t.id === selectedTrackId)!;
              const trackY = getTrackY(selectedTrack.order);
              
              return (
                <Rect
                  key={`selection-${selectedTrackId}`}
                  x={0}
                  y={trackY}
                  width={TIMELINE_WIDTH}
                  height={TRACK_HEIGHT}
                  stroke="#3B82F6" // Blue primary color
                  strokeWidth={2}
                  listening={false}
                />
              );
            })()}

            {/* Legacy audio track rendering removed - now using zebra striping */}
            {hasAudioTrack && (
              <>
                <Text
                  x={X_OFFSET + 8}
                  y={AUDIO_TRACK_Y - 18}
                  text="Audio Track"
                  fontSize={12}
                  fill={AUDIO_TRACK_LABEL_COLOR}
                  listening={false}
                />

                {audioClips.map((clip) => {
                  const asset = assetMap.get(clip.mediaId);
                  const clipStartX = timeToPixels(clip.start) + X_OFFSET;
                  const clipWidth = Math.max(
                    MIN_CLIP_WIDTH,
                    clip.duration * PIXELS_PER_SECOND,
                  );
                  const isSelected = isClipSelected(clip.id);
                  const waveformPoints =
                    asset?.waveform && clipWidth >= 10
                      ? generateWaveformPoints(
                          asset.waveform,
                          clipStartX,
                          AUDIO_TRACK_Y + AUDIO_TRACK_HEIGHT / 2,
                          clipWidth,
                          AUDIO_TRACK_HEIGHT - 16,
                        )
                      : null;

                  return (
                    <Group key={clip.id}>
                      <Rect
                        x={clipStartX}
                        y={AUDIO_TRACK_Y + 4}
                        width={clipWidth}
                        height={AUDIO_TRACK_HEIGHT - 8}
                        fill={AUDIO_CLIP_COLOR}
                        opacity={0.85}
                        cornerRadius={4}
                        stroke={isSelected ? "#FFFFFF" : "#6366F1"}
                        strokeWidth={isSelected ? 2 : 1}
                        onClick={(e) => {
                          e.cancelBubble = true;
                          handleClipClick(clip.id, e.evt.shiftKey, e.evt.metaKey || e.evt.ctrlKey);
                        }}
                      />
                      {waveformPoints && waveformPoints.length > 0 && (
                        <Line
                          points={waveformPoints}
                          stroke={AUDIO_WAVEFORM_COLOR}
                          strokeWidth={1}
                          tension={0.3}
                          listening={false}
                        />
                      )}
                      <Text
                        x={clipStartX + 6}
                        y={AUDIO_TRACK_Y + 8}
                        text={asset?.name || "Audio"}
                        fontSize={10}
                        fill="#FFFFFF"
                        width={clipWidth - 12}
                        ellipsis
                        listening={false}
                      />
                      <Text
                        x={clipStartX + 6}
                        y={AUDIO_TRACK_Y + AUDIO_TRACK_HEIGHT - 22}
                        text={`${clip.duration.toFixed(1)}s`}
                        fontSize={9}
                        fill="#C7D2FE"
                        listening={false}
                      />
                      {clip.volume !== undefined && clip.volume !== 1 && (
                        <Text
                          x={clipStartX + clipWidth - 34}
                          y={AUDIO_TRACK_Y + 8}
                          text={`${Math.round((clip.volume ?? 1) * 100)}%`}
                          fontSize={9}
                          fill={AUDIO_VOLUME_COLOR}
                          listening={false}
                        />
                      )}
                    </Group>
                  );
                })}
              </>
            )}

            {/* Beat markers */}
            {visibleBeatMarkers.map((beat, index) => {
              const x = timeToPixels(beat.time) + X_OFFSET;
              const isStrong =
                typeof beat.strength === "number"
                  ? beat.strength >= 0.75
                  : index % 4 === 0;
              return (
                <Line
                  key={`beat-${index}`}
                  points={[x, 0, x, timelineHeight]}
                  stroke={isStrong ? "#10B981" : "rgba(16,185,129,0.4)"}
                  strokeWidth={isStrong ? 1.5 : 1}
                  dash={isStrong ? [] : [4, 6]}
                  listening={false}
                />
              );
            })}

            {/* Clips - only render clips on visible tracks */}
            {clipsToRender.map((clip) => {
              const isDragging = clip.id === draggingClipId;
              const asset = assetMap.get(clip.mediaId);
              const track = findTrackByClipId(clip.id);

              // Skip rendering if track is not in visible range (unless dragging)
              if (track && !isDragging) {
                const isTrackVisible = visibleTracks.some((vt) => vt.id === track.id);
                if (!isTrackVisible) {
                  return null;
                }
              }

              // Skip rendering if track is not visible
              if (track && !track.visible) {
                return null;
              }

              // Handle solo mode: if any track has solo enabled, only render clips from solo tracks
              const hasSoloTracks = sortedTracks.some((t) => t.solo);
              if (hasSoloTracks && track && !track.solo) {
                return null;
              }

              const yPos = track ? getTrackY(track.order) : TIMELINE_HEADER_Y; // Fallback to header Y if track not found
              const trackOpacity = track?.opacity ?? 1.0;
              
              return (
                <KonvaClipItem
                  key={clip.id}
                  clip={clip}
                  asset={asset}
                  isSelected={isClipSelected(clip.id)}
                  isDragging={isDragging}
                  dragX={isDragging ? draggedClipX : undefined}
                  pixelsPerSecond={PIXELS_PER_SECOND}
                  xOffset={X_OFFSET}
                  yPos={yPos}
                  trackHeight={TRACK_HEIGHT}
                  opacity={trackOpacity}
                  onSelect={(shiftKey, metaKey) => handleClipClick(clip.id, shiftKey, metaKey)}
                  onDragStart={(startX, altKey, metaKey) => handleClipDragStart(clip.id, startX, altKey, metaKey)}
                  onDragMove={(currentX) =>
                    handleClipDragMove(clip.id, currentX)
                  }
                  onDragEnd={() => handleClipDragEnd(clip.id)}
                  onTrim={(newTrimStart, newTrimEnd) =>
                    onClipTrim(clip.id, newTrimStart, newTrimEnd)
                  }
                />
              );
            })}

            {/* Scrubber line (red - hover preview) */}
            {isHovering && (
              <Line
                points={[
                  timeToPixels(scrubberTime) + X_OFFSET,
                  0,
                  timeToPixels(scrubberTime) + X_OFFSET,
                  timelineHeight,
                ]}
                stroke="#EF4444"
                strokeWidth={2}
                listening={false}
              />
            )}

            {/* Magnetic snap guide lines (cyan - shown during drag) */}
            {snapGuides.map((snapTime, index) => (
              <Line
                key={`snap-guide-${index}`}
                points={[
                  timeToPixels(snapTime) + X_OFFSET,
                  0,
                  timeToPixels(snapTime) + X_OFFSET,
                  timelineHeight,
                ]}
                stroke="#00D9FF"
                strokeWidth={2}
                opacity={0.7}
                dash={[10, 5]} // Dashed line to distinguish from playhead
                listening={false}
              />
            ))}

            {/* Marquee selection rectangle (blue semi-transparent) */}
            {isMarqueeSelecting && marqueeStart && marqueeCurrent && (
              <Rect
                x={Math.min(marqueeStart.x, marqueeCurrent.x)}
                y={Math.min(marqueeStart.y, marqueeCurrent.y)}
                width={Math.abs(marqueeCurrent.x - marqueeStart.x)}
                height={Math.abs(marqueeCurrent.y - marqueeStart.y)}
                fill="rgba(59, 130, 246, 0.2)" // Blue with transparency
                stroke="rgba(59, 130, 246, 0.8)" // Blue border
                strokeWidth={2}
                dash={[5, 5]}
                listening={false}
              />
            )}

            {/* Slip/Slide mode indicator */}
            {editingMode !== 'normal' && draggingClipId && (() => {
              const draggedClip = clips.find((c) => c.id === draggingClipId);
              if (!draggedClip) return null;

              const modeText = editingMode === 'slip' ? 'SLIP EDIT' : 'SLIDE EDIT';
              const modeColor = editingMode === 'slip' ? '#F59E0B' : '#8B5CF6'; // Amber for slip, Purple for slide

              // Show current trimStart offset in slip mode
              const offsetText = editingMode === 'slip'
                ? `Offset: ${formatTime(draggedClip.trimStart)}`
                : '';

              // Position tooltip near the top-left of the dragged clip
              const draggedTrack = findTrackByClipId(draggedClip.id);
              const draggedClipY = draggedTrack ? getTrackY(draggedTrack.order) : TIMELINE_HEADER_Y;
              const clipX = draggedClipX;
              const tooltipX = clipX + 10;
              const tooltipY = draggedClipY - 30;

              return (
                <Group>
                  {/* Background for mode indicator */}
                  <Rect
                    x={tooltipX}
                    y={tooltipY}
                    width={120}
                    height={offsetText ? 50 : 30}
                    fill="rgba(0, 0, 0, 0.85)"
                    cornerRadius={6}
                    listening={false}
                  />

                  {/* Mode text */}
                  <Text
                    x={tooltipX + 10}
                    y={tooltipY + 8}
                    text={modeText}
                    fontSize={12}
                    fontStyle="bold"
                    fill={modeColor}
                    listening={false}
                  />

                  {/* Offset text (slip mode only) */}
                  {offsetText && (
                    <Text
                      x={tooltipX + 10}
                      y={tooltipY + 28}
                      text={offsetText}
                      fontSize={11}
                      fill="#FFFFFF"
                      listening={false}
                    />
                  )}
                </Group>
              );
            })()}

            {/* Playhead (white - actual position) - updated via ref */}
            <Line
              ref={playheadLineRef}
              points={[
                timeToPixels(currentTime) + X_OFFSET,
                0,
                timeToPixels(currentTime) + X_OFFSET,
                timelineHeight,
              ]}
              stroke="#FFFFFF"
              strokeWidth={2}
              listening={false}
            />
          </Layer>
        </Stage>
        </div>
        </div>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
        {Math.round(zoomLevel * 100)}%
      </div>
    </div>
  );
};

// Memoize the component to prevent re-renders when props haven't changed
export const KonvaTimeline = memo(KonvaTimelineComponent);
