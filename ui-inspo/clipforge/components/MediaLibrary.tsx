import { useState, useRef, useEffect } from 'react';
import { Upload, FolderOpen, Video } from 'lucide-react';
import { MediaLibraryProps } from '../types';
import { MediaThumbnail } from './MediaThumbnail';
import { cn } from '../lib/utils';
import { formatTime } from '../utils/timeFormat';

/**
 * MediaLibrary component
 * Left sidebar displaying imported media with drag-and-drop support
 */
export const MediaLibrary = ({
  items,
  onAddToTimeline,
  onRemove,
  onDrop,
  onImport,
  isRecording,
  isPicking,
  isSaving,
  elapsedTime,
  onStartPicking,
  onStopRecording,
  recordingError,
  onOpenSettings,
  recordingMode,
  onModeChange,
}: MediaLibraryProps & {
  isRecording?: boolean;
  isPicking?: boolean;
  isSaving?: boolean;
  elapsedTime?: number;
  onStartPicking?: () => void;
  onStopRecording?: () => void;
  recordingError?: string | null;
  onOpenSettings?: () => void;
  recordingMode?: "screen" | "webcam";
  onModeChange?: (mode: "screen" | "webcam") => void;
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showRecordingPopup, setShowRecordingPopup] = useState(false);
  const recordingPopupRef = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (recordingPopupRef.current && !recordingPopupRef.current.contains(event.target as Node)) {
        // Don't auto-close recording popup if recording is in progress
        if (!isRecording && !isSaving) {
          setShowRecordingPopup(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRecording, isSaving]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Get dropped files
    const files = Array.from(e.dataTransfer.files);

    // Filter for video files
    const videoFiles = files.filter(file =>
      file.type.startsWith('video/') ||
      file.name.match(/\.(mp4|mov|avi|webm|mkv)$/i)
    );

    if (videoFiles.length === 0) {
      console.warn('No video files detected in drop');
      return;
    }

    // Process each video file
    for (const file of videoFiles) {
      try {
        // Use Electron's webUtils to get the real file path
        const filePath = window.electronAPI.getPathForFile(file);
        console.log('✓ Dropped file:', file.name, 'Path:', filePath);

        if (onDrop) {
          await onDrop(filePath);
        }
      } catch (error) {
        console.error('Failed to process dropped file:', file.name, error);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-center px-4 py-3 border-b border-border bg-panel relative">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-bold tracking-wide">Media Library ({items.length})</h2>
        </div>
        <div className="absolute right-4 flex items-center gap-2">
          {/* Screen Recording Button */}
          {onStartPicking && onStopRecording && (
            <div className="relative" ref={recordingPopupRef}>
              <button
                onClick={() => setShowRecordingPopup(!showRecordingPopup)}
                disabled={isPicking || isSaving}
                className={cn(
                  "p-2 rounded transition-colors cursor-pointer",
                  isRecording ? "bg-red-500 hover:bg-red-600" : "bg-accent hover:bg-blue-600",
                  (isPicking || isSaving) && "opacity-50 cursor-not-allowed"
                )}
                title={isRecording ? "Stop Recording" : "Start Recording"}
              >
                <Video className="w-4 h-4 text-white" />
              </button>

              {showRecordingPopup && (
                <div className="absolute right-0 top-12 w-80 bg-panel border border-border rounded-lg shadow-xl z-50 p-4">
                  <h3 className="text-sm font-semibold mb-3">Screen Recording</h3>

                  {recordingError && (
                    <div className="mb-3 p-3 bg-red-500/10 border border-red-500 rounded text-sm text-red-500">
                      <div className="whitespace-pre-wrap break-words font-mono text-xs">
                        {recordingError}
                      </div>
                      {recordingError.includes("permission") && onOpenSettings && (
                        <button
                          onClick={onOpenSettings}
                          className="mt-2 px-3 py-1.5 bg-accent hover:bg-blue-600 rounded text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Open System Settings
                        </button>
                      )}
                    </div>
                  )}

                  {!isRecording && !isSaving ? (
                    <div className="space-y-3">
                      {/* Mode selector */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-300">Recording Mode</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => onModeChange && onModeChange("screen")}
                            className={cn(
                              "px-3 py-2 rounded text-sm font-semibold transition-colors cursor-pointer",
                              recordingMode === "screen"
                                ? "bg-accent text-white"
                                : "bg-background text-gray-400 hover:bg-background/80"
                            )}
                          >
                            🖥️ Screen
                          </button>
                          <button
                            onClick={() => onModeChange && onModeChange("webcam")}
                            className={cn(
                              "px-3 py-2 rounded text-sm font-semibold transition-colors cursor-pointer",
                              recordingMode === "webcam"
                                ? "bg-accent text-white"
                                : "bg-background text-gray-400 hover:bg-background/80"
                            )}
                          >
                            📹 Webcam
                          </button>
                          <button
                            onClick={() => onModeChange && onModeChange("both")}
                            className={cn(
                              "px-3 py-2 rounded text-sm font-semibold transition-colors cursor-pointer",
                              recordingMode === "both"
                                ? "bg-accent text-white"
                                : "bg-background text-gray-400 hover:bg-background/80"
                            )}
                          >
                            🎬 Both
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onStartPicking();
                        }}
                        disabled={isPicking}
                        className={cn(
                          "w-full px-4 py-2 bg-accent hover:bg-blue-600 rounded text-white font-semibold transition-colors cursor-pointer",
                          isPicking && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {isPicking ? "Starting..." : "Start Recording"}
                      </button>
                      <p className="text-xs text-gray-400 italic text-center">
                        {recordingMode === "screen"
                          ? "Record your screen"
                          : recordingMode === "webcam"
                          ? "Record from webcam"
                          : "Record screen + webcam (PiP)"}
                      </p>
                    </div>
                  ) : isSaving ? (
                    <div className="flex items-center gap-2 text-sm text-accent">
                      <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      Processing and importing video...
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold font-mono">{formatTime(elapsedTime || 0)}</span>
                        <button
                          onClick={() => {
                            onStopRecording();
                            setShowRecordingPopup(false);
                          }}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded text-white font-semibold transition-colors cursor-pointer"
                        >
                          Stop Recording
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Import Video Button */}
          {onImport && (
            <button
              onClick={onImport}
              className="p-2 bg-accent hover:bg-blue-600 rounded transition-colors cursor-pointer"
              title="Import Video"
            >
              <Upload className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Full-panel drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-accent/20 border-4 border-accent border-dashed flex items-center justify-center pointer-events-none">
          <div className="bg-panel/95 rounded-lg p-6 flex flex-col items-center gap-3">
            <Upload className="w-12 h-12 text-accent" />
            <div className="text-lg font-bold text-accent">Drop files here</div>
            <div className="text-sm text-gray-300">
              Supports MP4, MOV, AVI, WebM, MKV
            </div>
          </div>
        </div>
      )}

      {/* Media items list */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 h-full text-center">
            <FolderOpen className="w-12 h-12 text-gray-700 opacity-30" />
            <div className="text-sm font-semibold text-gray-500">
              No media imported yet
            </div>
            <div className="text-xs text-gray-600">
              Click the + icon or drag files here
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {items.map((item) => (
              <MediaThumbnail
                key={item.id}
                item={item}
                onClick={() => onAddToTimeline(item)}
                onRemove={() => onRemove(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
