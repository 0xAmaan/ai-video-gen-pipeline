/**
 * VideoPlayer Component
 *
 * Canvas-based video player that renders composite frames from a sequence.
 * Handles transitions, effects, and multi-track audio synchronization.
 *
 * This is a PURE RENDERING component - it does not handle editing UI.
 * All editing logic belongs in the timeline component.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoPlayerProps } from "@/lib/editor/player/types";
import { FrameRenderer } from "@/lib/editor/player/frame-renderer";
import { PlaybackController } from "@/lib/editor/player/playback-controller";

export const VideoPlayer = ({
  sequence,
  mediaAssets,
  currentTime,
  isPlaying,
  masterVolume = 1.0,
  className = "",
  onTimeUpdate,
  onEnded,
  onError,
}: VideoPlayerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRendererRef = useRef<FrameRenderer | null>(null);
  const playbackControllerRef = useRef<PlaybackController | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [renderError, setRenderError] = useState<Error | null>(null);
  const lastSeekTimeRef = useRef<number>(currentTime);

  /**
   * Initialize renderer and playback controller
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const init = async () => {
      try {
        // Create frame renderer
        const frameRenderer = new FrameRenderer({
          width: sequence.width,
          height: sequence.height,
          enableCache: true,
          maxCacheSize: 100,
          useWebGL: false, // Start with Canvas 2D for stability
        });

        await frameRenderer.attach(canvas);
        frameRendererRef.current = frameRenderer;

        // Create playback controller
        const playbackController = new PlaybackController(
          frameRenderer,
          sequence,
          mediaAssets,
          {
            onTimeUpdate: (time) => {
              onTimeUpdate?.(time);
            },
            onEnded: () => {
              onEnded?.();
            },
            onError: (error) => {
              setRenderError(error);
              onError?.(error);
            },
          }
        );

        playbackControllerRef.current = playbackController;
        setIsInitialized(true);
      } catch (error) {
        const err =
          error instanceof Error ? error : new Error("Failed to initialize player");
        setRenderError(err);
        onError?.(err);
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      playbackControllerRef.current?.destroy();
      frameRendererRef.current?.detach();
      playbackControllerRef.current = null;
      frameRendererRef.current = null;
      setIsInitialized(false);
    };
  }, [sequence.width, sequence.height]); // Re-init if resolution changes

  /**
   * Handle currentTime changes (seeking/scrubbing)
   * Seek when user clicks timeline, even during playback
   */
  useEffect(() => {
    if (!isInitialized || !playbackControllerRef.current) return;

    // Check if this is a user-initiated seek (not from playback updates)
    const timeDifference = Math.abs(currentTime - lastSeekTimeRef.current);
    const SEEK_THRESHOLD = 0.1; // 100ms threshold to detect user seeks

    // If time jumped significantly, it's a user seek - apply it
    if (timeDifference > SEEK_THRESHOLD) {
      playbackControllerRef.current.seek(currentTime);
      lastSeekTimeRef.current = currentTime;
    }
  }, [currentTime, isInitialized]);

  /**
   * Handle play/pause changes
   */
  useEffect(() => {
    if (!isInitialized || !playbackControllerRef.current) return;

    if (isPlaying) {
      playbackControllerRef.current.play();
    } else {
      playbackControllerRef.current.pause();
    }
  }, [isPlaying, isInitialized]);

  /**
   * Handle master volume changes
   */
  useEffect(() => {
    if (!isInitialized || !playbackControllerRef.current) return;

    playbackControllerRef.current.setMasterVolume(masterVolume);
  }, [masterVolume, isInitialized]);

  /**
   * Update sequence data when it changes
   */
  useEffect(() => {
    if (!isInitialized || !playbackControllerRef.current) return;

    playbackControllerRef.current.updateSequence(sequence, mediaAssets);
  }, [sequence, mediaAssets, isInitialized]);

  return (
    <div
      className={`video-player relative bg-black ${className}`}
      style={{
        aspectRatio: `${sequence.width} / ${sequence.height}`,
        maxWidth: "100%",
      }}
    >
      <canvas
        ref={canvasRef}
        width={sequence.width}
        height={sequence.height}
        className="w-full h-full object-contain"
        style={{
          display: "block",
          imageRendering: "auto",
        }}
      />

      {/* Error overlay */}
      {renderError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-4">
          <div className="text-center">
            <div className="text-red-500 text-lg font-semibold mb-2">
              Render Error
            </div>
            <div className="text-sm text-gray-300">{renderError.message}</div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {!isInitialized && !renderError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-white text-sm">Initializing player...</div>
        </div>
      )}
    </div>
  );
};
