/**
 * Utility hook to access Twick editor functionality from components outside EditorController.
 * This hook provides access to the global Twick editor instance and its methods.
 * 
 * Usage:
 * ```tsx
 * const twick = useTwickEditor();
 * if (twick) {
 *   twick.togglePlayback();
 *   twick.splitElement(element, time);
 * }
 * ```
 */

import { useEffect, useState } from "react";
import type { TimelineEditor, TrackElement, Track } from "@twick/timeline";

export interface TwickEditorAPI {
  editor: TimelineEditor;
  togglePlayback: () => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  addElement: (element: TrackElement) => Promise<void>;
  updateElement: (element: TrackElement) => void;
  splitElement: (element: TrackElement, currentTime: number) => void;
  deleteItem: (item: Track | TrackElement) => void;
  undo: () => void;
  redo: () => void;
  livePlayerContext: any;
}

declare global {
  interface Window {
    __twickEditor?: TwickEditorAPI;
  }
}

/**
 * Hook to access the global Twick editor instance.
 * Returns null if the editor is not yet initialized.
 */
export const useTwickEditor = (): TwickEditorAPI | null => {
  const [api, setApi] = useState<TwickEditorAPI | null>(null);

  useEffect(() => {
    // Check if editor is available
    if (typeof window !== "undefined" && window.__twickEditor) {
      setApi(window.__twickEditor);
    }

    // Poll for editor availability (in case it's not ready yet)
    const interval = setInterval(() => {
      if (typeof window !== "undefined" && window.__twickEditor) {
        setApi(window.__twickEditor);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return api;
};

/**
 * Get the Twick editor API synchronously (non-hook version).
 * Use this in event handlers or callbacks where hooks can't be used.
 * Returns undefined if editor is not initialized.
 */
export const getTwickEditor = (): TwickEditorAPI | undefined => {
  if (typeof window !== "undefined") {
    return window.__twickEditor;
  }
  return undefined;
};
