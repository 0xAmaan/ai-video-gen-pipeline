import { useEffect, useRef, useState, useCallback } from 'react';
import { VideoLoader } from '../playback/video-loader';
import type { MediaAssetMeta } from '../types';

interface UseVideoFramePreviewResult {
  frame: VideoFrame | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch and manage video frames for real-time preview during slip editing.
 * Uses VideoLoader's frame cache for efficient decoding with debounced updates.
 *
 * @param asset - Media asset containing video source URL
 * @param timeSeconds - Time position in seconds to extract frame from
 * @param enabled - Whether preview is active (stops fetching when false)
 * @returns VideoFrame, loading state, and error if any
 *
 * @example
 * const { frame, loading, error } = useVideoFramePreview(asset, 5.2, isSlipping);
 * // Render frame to canvas when available
 */
export function useVideoFramePreview(
  asset: MediaAssetMeta | undefined,
  timeSeconds: number | null,
  enabled: boolean
): UseVideoFramePreviewResult {
  const [frame, setFrame] = useState<VideoFrame | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loaderRef = useRef<VideoLoader | null>(null);
  const rafRef = useRef<number | null>(null);
  const currentFrameRef = useRef<VideoFrame | null>(null);
  const requestIdRef = useRef<number>(0); // Fix: Track request IDs to prevent race conditions

  // Initialize VideoLoader when asset changes
  useEffect(() => {
    if (!asset || !enabled) {
      // Clean up loader if disabled
      if (loaderRef.current) {
        loaderRef.current.dispose();
        loaderRef.current = null;
      }
      return;
    }

    const initLoader = async () => {
      try {
        setLoading(true);
        setError(null);

        const loader = new VideoLoader(asset);
        await loader.init();
        loaderRef.current = loader;

        setLoading(false);
      } catch (err) {
        console.error('[useVideoFramePreview] Failed to initialize VideoLoader:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    };

    initLoader();

    return () => {
      if (loaderRef.current) {
        loaderRef.current.dispose();
        loaderRef.current = null;
      }
    };
  }, [asset?.id, enabled]);

  // Update frame when timeSeconds changes (debounced via RAF)
  useEffect(() => {
    if (!enabled || timeSeconds === null || !loaderRef.current) {
      return;
    }

    // Cancel any pending RAF
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    // Debounce using requestAnimationFrame (max 60fps)
    rafRef.current = requestAnimationFrame(() => {
      const fetchFrame = async () => {
        if (!loaderRef.current) return;

        // Fix: Increment request ID to detect stale requests
        const currentRequestId = ++requestIdRef.current;

        try {
          setLoading(true);
          setError(null);

          // Get frame from VideoLoader (uses cache if available)
          const newFrame = await loaderRef.current.getFrameAt(timeSeconds);

          // Fix: Check if this request is still valid (prevent race condition)
          if (currentRequestId !== requestIdRef.current) {
            // This is a stale request, discard the frame
            if (newFrame) {
              newFrame.close();
            }
            return;
          }

          // Fix: Close previous frame in state to prevent memory leak
          setFrame((prevFrame) => {
            if (prevFrame && prevFrame !== newFrame) {
              prevFrame.close();
            }
            if (currentFrameRef.current && currentFrameRef.current !== newFrame) {
              currentFrameRef.current.close();
            }
            currentFrameRef.current = newFrame;
            return newFrame;
          });

          setLoading(false);
        } catch (err) {
          // Only update error state if this is still the current request
          if (currentRequestId === requestIdRef.current) {
            console.error('[useVideoFramePreview] Failed to fetch frame at', timeSeconds, ':', err);
            setError(err instanceof Error ? err : new Error(String(err)));
            setLoading(false);
          }
        }
      };

      fetchFrame();
      rafRef.current = null;
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [timeSeconds, enabled]); // Fix: Removed fetchFrame from dependencies to prevent infinite loop

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Close current frame
      if (currentFrameRef.current) {
        currentFrameRef.current.close();
        currentFrameRef.current = null;
      }

      // Cancel pending RAF
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return { frame, loading, error };
}
