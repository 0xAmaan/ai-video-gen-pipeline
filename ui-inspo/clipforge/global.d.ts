export {};

declare global {
  interface Window {
    electronAPI: {
      // File operations
      openFile: () => Promise<string | null>;
      saveFile: (defaultPath: string) => Promise<string | null>;
      getFileUrl: (filePath: string) => string;

      // Video operations
      getVideoMetadata: (filePath: string) => Promise<VideoMetadata>;
      trimVideo: (
        input: string,
        output: string,
        start: number,
        end: number,
      ) => Promise<string>;
      exportMultiClip: (
        clips: Array<{
          sourceFilePath: string;
          sourceStart: number;
          sourceEnd: number;
        }>,
        outputPath: string,
        options: { mode: "fast" | "reencode"; resolution?: string },
      ) => Promise<string>;

      // Progress updates
      onExportProgress: (
        callback: (progress: number, message?: string) => void,
      ) => void;

      // Screen recording operations
      checkScreenRecordingPermission: () => Promise<PermissionStatus>;
      getScreenSources: () => Promise<ScreenSource[]>;
      saveRecording: (buffer: ArrayBuffer, filename: string) => Promise<string>;
      openSystemSettings: () => Promise<void>;

      // Camera operations
      checkCameraPermission: () => Promise<PermissionStatus>;
      requestCameraPermission: () => Promise<{
        granted: boolean;
        platform: string;
      }>;
      convertWebmToMov: (webmPath: string) => Promise<string>;
      overlayWebcamOnScreen: (
        screenPath: string,
        webcamPath: string,
        offsetSeconds: number,
      ) => Promise<string>;

      // screencapture recording
      getAVFoundationDisplays: () => Promise<AVFoundationDisplay[]>;
      startFFmpegRecording: (
        displayId: string,
        filename: string,
      ) => Promise<string>;
      stopFFmpegRecording: () => Promise<boolean>;
      convertMovToMp4: (movPath: string) => Promise<string>;

      // Media library operations
      generateThumbnail: (filePath: string) => Promise<string>;
      generateClipThumbnails: (
        videoPath: string,
        clipId: string,
        sourceStart: number,
        sourceEnd: number,
        frameInterval?: number,
      ) => Promise<Array<{ timestamp: number; path: string }>>;
      cleanupClipThumbnails: (videoPath: string) => Promise<boolean>;
      getFileSize: (filePath: string) => Promise<number>;
      saveMediaLibrary: (items: MediaItem[]) => Promise<boolean>;
      loadMediaLibrary: () => Promise<MediaItem[]>;
      deleteFile: (filePath: string) => Promise<boolean>;

      // File utilities
      getPathForFile: (file: File) => string;
    };
  }
}

export interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
  type: "screen" | "window";
}

export interface AVFoundationDisplay {
  id: string;
  name: string;
  type: "screen";
}

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
  currentTime: number;
  trimStart: number;
  trimEnd: number;
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

export interface PermissionStatus {
  status:
    | "not-determined"
    | "granted"
    | "denied"
    | "restricted"
    | "unknown"
    | "not-applicable";
  platform: string;
  granted: boolean;
  isDevelopment: boolean;
  executablePath?: string;
}
