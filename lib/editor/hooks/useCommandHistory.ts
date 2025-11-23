/**
 * React hook for command-based undo/redo history
 *
 * This hook provides access to the command-based history system alongside
 * the existing snapshot-based system in the project store.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { HistoryManager } from "../history/HistoryManager";
import type { Command } from "../history/command";
import type { HistoryStats } from "../history/HistoryManager";

/**
 * Hook for managing command-based history with keyboard shortcuts
 */
export function useCommandHistory() {
  // Create a stable HistoryManager instance
  const managerRef = useRef<HistoryManager | null>(null);
  const [stats, setStats] = useState<HistoryStats>({
    undoCount: 0,
    redoCount: 0,
    totalCount: 0,
    canUndo: false,
    canRedo: false,
    memoryEstimate: 0,
  });

  // Initialize manager on first render
  if (!managerRef.current) {
    managerRef.current = new HistoryManager({
      maxDepth: 50,
      onChange: (manager) => {
        setStats(manager.getStats());
      },
    });
  }

  const manager = managerRef.current;

  // Execute a command
  const execute = useCallback((command: Command): boolean => {
    return manager.execute(command);
  }, [manager]);

  // Undo the last command
  const undo = useCallback((): boolean => {
    return manager.undo();
  }, [manager]);

  // Redo the last undone command
  const redo = useCallback((): boolean => {
    return manager.redo();
  }, [manager]);

  // Clear all history
  const clear = useCallback((): void => {
    manager.clear();
  }, [manager]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Z or Ctrl+Z for undo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const success = manager.undo();
        if (success) {
          console.log("[History] Undo:", manager.getUndoDescription());
        }
      }

      // Cmd+Shift+Z or Ctrl+Shift+Z for redo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        const success = manager.redo();
        if (success) {
          console.log("[History] Redo:", manager.getRedoDescription());
        }
      }

      // Cmd+Y or Ctrl+Y for redo (alternative)
      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        const success = manager.redo();
        if (success) {
          console.log("[History] Redo:", manager.getRedoDescription());
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [manager]);

  return {
    /** Execute a command and add it to history */
    execute,
    /** Undo the last command */
    undo,
    /** Redo the last undone command */
    redo,
    /** Clear all history */
    clear,
    /** History statistics */
    stats,
    /** Get the last N commands for debugging */
    getRecentHistory: useCallback((count = 10) => manager.getRecentHistory(count), [manager]),
    /** Get formatted history timeline */
    getHistoryTimeline: useCallback(() => manager.getHistoryTimeline(), [manager]),
    /** Get description of command that would be undone */
    getUndoDescription: useCallback(() => manager.getUndoDescription(), [manager]),
    /** Get description of command that would be redone */
    getRedoDescription: useCallback(() => manager.getRedoDescription(), [manager]),
    /** Direct access to the HistoryManager instance */
    manager,
  };
}

/**
 * Hook for keyboard-only history controls (no manager access)
 * Useful when you just want keyboard shortcuts without managing commands
 */
export function useHistoryKeyboardShortcuts(
  onUndo: () => void,
  onRedo: () => void,
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Z or Ctrl+Z for undo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      }

      // Cmd+Shift+Z or Ctrl+Shift+Z for redo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        onRedo();
      }

      // Cmd+Y or Ctrl+Y for redo (alternative)
      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        onRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onUndo, onRedo]);
}
