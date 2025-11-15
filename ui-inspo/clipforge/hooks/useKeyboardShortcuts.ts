import { useEffect } from "react";
import { VideoPlayerHandle } from "../components/VideoPlayer";

interface UseKeyboardShortcutsProps {
  videoPlayerRef: React.RefObject<VideoPlayerHandle>;
  isPlaying: boolean;
  hasClips: boolean;
  selectedClipId: string | null;
  currentTime: number;
  onDeleteClip: (clipId: string) => void;
  onSplitClip: (timelineTime: number) => void;
}

/**
 * Custom hook for handling keyboard shortcuts in the video editor
 * Currently supports:
 * - Space: Play/Pause video
 * - Delete: Remove selected clip from timeline
 * - B: Split clip at playhead position
 */
export const useKeyboardShortcuts = ({
  videoPlayerRef,
  isPlaying,
  hasClips,
  selectedClipId,
  currentTime,
  onDeleteClip,
  onSplitClip,
}: UseKeyboardShortcutsProps) => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts when clips are loaded
      if (!hasClips) return;

      // Spacebar: Play/Pause
      if (e.code === "Space") {
        e.preventDefault(); // Prevent default scrolling behavior

        if (videoPlayerRef.current) {
          if (isPlaying) {
            videoPlayerRef.current.pause();
          } else {
            videoPlayerRef.current.play();
          }
        }
      }

      // Delete: Remove selected clip from timeline
      if (e.code === "Delete" || e.code === "Backspace") {
        if (selectedClipId) {
          e.preventDefault();
          onDeleteClip(selectedClipId);
        }
      }

      // B: Split clip at playhead position
      if (e.code === "KeyB") {
        e.preventDefault();
        onSplitClip(currentTime);
      }

      // Add more keyboard shortcuts here in the future
      // Example:
      // - Arrow Left/Right: Seek backward/forward
      // - Arrow Up/Down: Navigate between clips
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [
    videoPlayerRef,
    isPlaying,
    hasClips,
    selectedClipId,
    currentTime,
    onDeleteClip,
    onSplitClip,
  ]);
};
