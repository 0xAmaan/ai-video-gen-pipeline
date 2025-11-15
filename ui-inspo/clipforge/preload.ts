// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, webUtils } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // File operations
  openFile: () => ipcRenderer.invoke("open-file"),
  saveFile: (defaultPath: string) =>
    ipcRenderer.invoke("save-file", defaultPath),

  // Convert file path to safe URL for media elements
  getFileUrl: (filePath: string) => {
    if (!filePath) return "";
    // Convert absolute file path to safe-file:// protocol
    // Split path by '/' and encode each segment individually to preserve path structure
    const pathSegments = filePath.split("/");
    const encodedPath = pathSegments
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `safe-file://${encodedPath}`;
  },

  // Video operations
  getVideoMetadata: (filePath: string) =>
    ipcRenderer.invoke("get-video-metadata", filePath),

  trimVideo: (input: string, output: string, start: number, end: number) =>
    ipcRenderer.invoke("trim-video", input, output, start, end),

  exportMultiClip: (
    clips: Array<{
      sourceFilePath: string;
      sourceStart: number;
      sourceEnd: number;
    }>,
    outputPath: string,
    options: { mode: "fast" | "reencode"; resolution?: string },
  ) => ipcRenderer.invoke("export-multi-clip", clips, outputPath, options),

  // Progress updates
  onExportProgress: (
    callback: (progress: number, message?: string) => void,
  ) => {
    ipcRenderer.on("export-progress", (_, progress, message) =>
      callback(progress, message),
    );
  },

  // Screen recording operations
  checkScreenRecordingPermission: () =>
    ipcRenderer.invoke("check-screen-recording-permission"),
  getScreenSources: () => ipcRenderer.invoke("get-screen-sources"),
  saveRecording: (buffer: ArrayBuffer, filename: string) =>
    ipcRenderer.invoke("save-recording", buffer, filename),
  openSystemSettings: () => ipcRenderer.invoke("open-system-settings"),

  // Camera operations
  checkCameraPermission: () => ipcRenderer.invoke("check-camera-permission"),
  requestCameraPermission: () =>
    ipcRenderer.invoke("request-camera-permission"),
  convertWebmToMov: (webmPath: string) =>
    ipcRenderer.invoke("convert-webm-to-mov", webmPath),
  overlayWebcamOnScreen: (
    screenPath: string,
    webcamPath: string,
    offsetSeconds: number,
  ) =>
    ipcRenderer.invoke(
      "overlay-webcam-on-screen",
      screenPath,
      webcamPath,
      offsetSeconds,
    ),

  // screencapture recording
  getAVFoundationDisplays: () =>
    ipcRenderer.invoke("get-avfoundation-displays"),
  startFFmpegRecording: (displayId: string, filename: string) =>
    ipcRenderer.invoke("start-ffmpeg-recording", displayId, filename),
  stopFFmpegRecording: () => ipcRenderer.invoke("stop-ffmpeg-recording"),
  convertMovToMp4: (movPath: string) =>
    ipcRenderer.invoke("convert-mov-to-mp4", movPath),

  // Media library operations
  generateThumbnail: (filePath: string) =>
    ipcRenderer.invoke("generate-thumbnail", filePath),
  generateClipThumbnails: (
    videoPath: string,
    clipId: string,
    sourceStart: number,
    sourceEnd: number,
    frameInterval?: number,
  ) =>
    ipcRenderer.invoke(
      "generate-clip-thumbnails",
      videoPath,
      clipId,
      sourceStart,
      sourceEnd,
      frameInterval,
    ),
  cleanupClipThumbnails: (videoPath: string) =>
    ipcRenderer.invoke("cleanup-clip-thumbnails", videoPath),
  getFileSize: (filePath: string) =>
    ipcRenderer.invoke("get-file-size", filePath),
  saveMediaLibrary: (items: any[]) =>
    ipcRenderer.invoke("save-media-library", items),
  loadMediaLibrary: () => ipcRenderer.invoke("load-media-library"),
  deleteFile: (filePath: string) => ipcRenderer.invoke("delete-file", filePath),

  // Get file path from File object (for drag-and-drop)
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
});
