import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause } from 'lucide-react';
import { VideoPlayerProps } from '../types';
import { formatTime } from '../utils/timeFormat';

/**
 * VideoPlayer component handle - methods that can be called from parent
 */
export interface VideoPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
}

/**
 * VideoPlayer component
 * Displays HTML5 video player with play/pause controls and time display
 */
export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  (
    {
      videoPath,
      clipId,
      currentTime,
      displayTime,
      trimStart,
      trimEnd,
      totalDuration,
      isPlaying,
      onTimeUpdate,
      onPlayPause,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Expose methods to parent component via ref
    useImperativeHandle(ref, () => ({
      play: () => {
        if (videoRef.current) {
          videoRef.current.play();
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      },
      seek: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      getCurrentTime: () => {
        return videoRef.current?.currentTime || 0;
      },
    }));

    // Handle video time updates
    const handleTimeUpdate = () => {
      if (videoRef.current) {
        const currentTime = videoRef.current.currentTime;

        // Clamp playback to trim boundaries
        if (currentTime < trimStart) {
          videoRef.current.currentTime = trimStart;
        }
        // Note: Don't pause when reaching trimEnd - let App.tsx handle clip transitions

        onTimeUpdate(videoRef.current.currentTime);
      }
    };

    // Handle play/pause button click
    const handlePlayPause = async () => {
      if (videoRef.current) {
        if (videoRef.current.paused) {
          try {
            await videoRef.current.play();
            onPlayPause(true);
          } catch (err) {
            console.error('Play failed:', err);
          }
        } else {
          videoRef.current.pause();
          onPlayPause(false);
        }
      }
    };

    // Track the last video path to detect when we switch to a different file
    const lastVideoPathRef = useRef<string | null>(null);
    const isPlayingRef = useRef<boolean>(false);

    // Keep isPlaying ref in sync
    useEffect(() => {
      isPlayingRef.current = isPlaying || false;
    }, [isPlaying]);

    // Update video source when videoPath changes (but not for clip transitions within same file)
    useEffect(() => {
      if (videoRef.current && videoPath) {
        // Convert file path to file:// URL
        const videoUrl = videoPath.startsWith('file://')
          ? videoPath
          : `file://${videoPath}`;

        // Check if we're switching to a different file
        const isSameFile = lastVideoPathRef.current === videoPath;

        // Only reload if the source file actually changed
        if (isSameFile) {
          // Same file, just seek to the new time (handled by currentTime effect)
          // But make sure playback continues if it was playing
          if (isPlayingRef.current && videoRef.current.paused) {
            videoRef.current.play().catch(err => {
              console.error('Resume play failed:', err);
            });
          }
          return;
        }

        lastVideoPathRef.current = videoPath;

        videoRef.current.src = videoUrl;
        videoRef.current.load(); // Explicitly load the new source

        // Autoplay when video is loaded if playback was active (for clip transitions)
        videoRef.current.onloadeddata = () => {
          if (isPlayingRef.current && videoRef.current) {
            videoRef.current.play().catch(err => {
              console.error('Autoplay failed:', err);
            });
          }
        };

        // Add error handler
        videoRef.current.onerror = (e) => {
          console.error('Video load error:', e);
          console.error('Video error code:', videoRef.current?.error?.code);
          console.error('Video error message:', videoRef.current?.error?.message);
        };
      }
    }, [videoPath]);

    // Seek to currentTime when it's updated externally (e.g., from timeline or clip transitions)
    useEffect(() => {
      if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
        videoRef.current.currentTime = currentTime;
        
        // Resume playback if it should be playing (important for clip transitions)
        if (isPlayingRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(err => {
            console.error('Resume play after seek failed:', err);
          });
        }
      }
    }, [currentTime]);

    if (!videoPath) {
      return null; // Let the parent handle the empty state
    }

    const isPaused = videoRef.current?.paused !== false;

    return (
      <div className="relative w-full max-w-full">
        <video
          ref={videoRef}
          className="w-full h-auto max-h-[50vh] bg-black rounded cursor-pointer"
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => onPlayPause(true)}
          onPause={() => onPlayPause(false)}
          onClick={handlePlayPause}
        />

        {/* Play overlay - only show when paused */}
        {isPaused && (
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={handlePlayPause}
          >
            <div className="w-20 h-20 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors">
              <Play className="w-10 h-10 text-white ml-1" />
            </div>
          </div>
        )}

        {/* Time display overlay */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 bg-black/80 rounded text-xs text-white font-mono">
          <span className="font-bold">{formatTime(displayTime ?? currentTime)}</span>
          <span className="opacity-60">/</span>
          <span className="opacity-80">{formatTime(totalDuration ?? (trimEnd - trimStart))}</span>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
