// Shared type definitions for ClipForge

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec?: string;
}

export interface VideoState {
  filePath: string | null;
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  isPlaying: boolean;
}

export interface VideoPlayerProps {
  videoPath: string | null;
  clipId?: string; // Current clip ID (for detecting clip changes when same file is reused)
  currentTime: number;
  displayTime?: number; // Timeline time to display in UI (used during scrubbing)
  trimStart: number;
  trimEnd: number;
  totalDuration?: number; // Total timeline duration for display
  isPlaying?: boolean; // Whether playback is active (for clip transitions)
  onTimeUpdate: (time: number) => void;
  onPlayPause: (isPlaying: boolean) => void;
}

export interface TimelineProps {
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  onSeek: (time: number) => void;
  onTrimChange: (start: number, end: number) => void;
}

export interface ExportProps {
  videoPath: string;
  trimStart: number;
  trimEnd: number;
  onExportComplete: (outputPath: string) => void;
}

export interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
  type: "screen" | "window";
}

export type RecordingMode = "screen" | "webcam" | "both";

export interface RecordingState {
  isRecording: boolean;
  isPicking: boolean;
  isSaving?: boolean;
  selectedSource: ScreenSource | null;
  startTime: number | null;
  elapsedTime: number;
  mode: RecordingMode;
}

// Multi-clip timeline types
export interface Clip {
  id: string; // Unique identifier
  sourceFilePath: string; // Path to source video file
  sourceStart: number; // Trim start time in source video (seconds)
  sourceEnd: number; // Trim end time in source video (seconds)
  timelineStart: number; // Position on timeline where clip starts (seconds)
  duration: number; // Calculated: sourceEnd - sourceStart
  sourceMetadata?: VideoMetadata; // Cached metadata for source file
  thumbnails?: Array<{
    timestamp: number; // Timestamp in source video (seconds)
    path: string; // File path to thumbnail image
  }>;
  thumbnailsLoading?: boolean; // Whether thumbnails are currently being generated
}

export interface ProjectState {
  clips: Clip[]; // Array of all clips on timeline
  selectedClipId: string | null; // Currently selected clip ID
  currentTime: number; // Playhead position in seconds
  totalDuration: number; // Sum of all clip durations
  isPlaying: boolean; // Playback state
}

// Updated component props for multi-clip support
export interface MultiClipTimelineProps {
  clips: Clip[];
  selectedClipId: string | null;
  currentTime: number;
  totalDuration: number;
  onClipSelect: (id: string) => void;
  onClipMove: (id: string, newTimelineStart: number) => void;
  onClipReorder?: (reorderedClips: Clip[]) => void; // Called when clips are reordered via drag-drop
  onClipTrim: (
    id: string,
    newSourceStart: number,
    newSourceEnd: number,
  ) => void;
  onSeek: (time: number) => void;
  onScrub?: (time: number) => void; // Called during hover scrubbing for preview
  onScrubEnd?: () => void; // Called when scrubbing ends (mouse leaves timeline)
}

export interface ClipItemProps {
  clip: Clip;
  isSelected: boolean;
  pixelsPerSecond: number;
  xOffset?: number; // Horizontal offset for padding
  isDragging?: boolean; // Whether this clip is currently being dragged
  dragX?: number; // X position during drag (for cursor following)
  onSelect: () => void;
  onDragStart?: (startX: number) => void;
  onDragMove?: (currentX: number) => void;
  onDragEnd?: () => void;
  onTrim: (newSourceStart: number, newSourceEnd: number) => void;
}

export interface MultiClipVideoPlayerProps {
  clips: Clip[];
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onPlayPause: (isPlaying: boolean) => void;
}

export interface MultiClipExportProps {
  clips: Clip[];
  onExportComplete: (outputPath: string) => void;
}

export interface ExportOptions {
  mode: "fast" | "reencode";
  resolution?: "720p" | "1080p" | "source";
}

// Media Library types
export interface MediaItem {
  id: string;
  filePath: string;
  fileName: string;
  thumbnail: string;
  duration: number;
  resolution: string;
  fileSize: number;
  addedAt: number;
}

export interface MediaLibraryProps {
  items: MediaItem[];
  onAddToTimeline: (item: MediaItem) => void;
  onRemove: (id: string) => void;
  onDrop?: (filePath: string) => void;
  onImport?: () => void;
}

export interface MediaThumbnailProps {
  item: MediaItem;
  onClick: () => void;
  onRemove: () => void;
}
