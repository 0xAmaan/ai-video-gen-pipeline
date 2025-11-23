/**
 * History Manager - Command Pattern Undo/Redo System
 *
 * Manages a stack of reversible commands with configurable history depth.
 * Provides efficient undo/redo operations without full project snapshots.
 */

import type { Command, SerializedCommand } from "./command";

/**
 * Configuration options for HistoryManager
 */
export interface HistoryManagerConfig {
  /** Maximum number of commands to keep in history (default: 50) */
  maxDepth?: number;

  /** Callback when history state changes */
  onChange?: (manager: HistoryManager) => void;
}

/**
 * History statistics for debugging and UI display
 */
export interface HistoryStats {
  /** Number of commands that can be undone */
  undoCount: number;

  /** Number of commands that can be redone */
  redoCount: number;

  /** Total commands in history */
  totalCount: number;

  /** Whether undo is available */
  canUndo: boolean;

  /** Whether redo is available */
  canRedo: boolean;

  /** Memory estimate in bytes (approximate) */
  memoryEstimate: number;
}

/**
 * Manages the command history stack for undo/redo operations
 */
export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxDepth: number;
  private onChange?: (manager: HistoryManager) => void;

  constructor(config: HistoryManagerConfig = {}) {
    this.maxDepth = config.maxDepth ?? 50;
    this.onChange = config.onChange;
  }

  /**
   * Execute a command and add it to the undo stack
   */
  execute(command: Command): boolean {
    const success = command.execute();

    if (success) {
      // Clear redo stack when a new command is executed
      this.redoStack = [];

      // Add to undo stack
      this.undoStack.push(command);

      // Enforce max depth
      if (this.undoStack.length > this.maxDepth) {
        this.undoStack.shift();
      }

      this.notifyChange();
    }

    return success;
  }

  /**
   * Undo the last executed command
   */
  undo(): boolean {
    if (!this.canUndo()) {
      console.warn("[HistoryManager] Nothing to undo");
      return false;
    }

    const command = this.undoStack.pop()!;
    const success = command.undo();

    if (success) {
      this.redoStack.push(command);
      this.notifyChange();
    } else {
      // If undo failed, restore command to undo stack
      this.undoStack.push(command);
    }

    return success;
  }

  /**
   * Redo the last undone command
   */
  redo(): boolean {
    if (!this.canRedo()) {
      console.warn("[HistoryManager] Nothing to redo");
      return false;
    }

    const command = this.redoStack.pop()!;
    const success = command.execute();

    if (success) {
      this.undoStack.push(command);
      this.notifyChange();
    } else {
      // If redo failed, restore command to redo stack
      this.redoStack.push(command);
    }

    return success;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyChange();
  }

  /**
   * Get the last N commands from the undo stack for debugging
   */
  getRecentHistory(count: number = 10): Command[] {
    return this.undoStack.slice(-count);
  }

  /**
   * Get statistics about the history state
   */
  getStats(): HistoryStats {
    const undoCount = this.undoStack.length;
    const redoCount = this.redoStack.length;

    // Rough memory estimate: assume each command ~1KB
    const memoryEstimate = (undoCount + redoCount) * 1024;

    return {
      undoCount,
      redoCount,
      totalCount: undoCount + redoCount,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      memoryEstimate,
    };
  }

  /**
   * Serialize the history for persistence
   */
  serialize(): {
    undoStack: SerializedCommand[];
    redoStack: SerializedCommand[];
    maxDepth: number;
  } {
    return {
      undoStack: this.undoStack.map(cmd => cmd.serialize()),
      redoStack: this.redoStack.map(cmd => cmd.serialize()),
      maxDepth: this.maxDepth,
    };
  }

  /**
   * Get a description of the command that would be undone
   */
  getUndoDescription(): string | null {
    const command = this.undoStack[this.undoStack.length - 1];
    return command ? command.description : null;
  }

  /**
   * Get a description of the command that would be redone
   */
  getRedoDescription(): string | null {
    const command = this.redoStack[this.redoStack.length - 1];
    return command ? command.description : null;
  }

  /**
   * Get all commands in the undo stack (for debugging)
   */
  getUndoStack(): readonly Command[] {
    return this.undoStack;
  }

  /**
   * Get all commands in the redo stack (for debugging)
   */
  getRedoStack(): readonly Command[] {
    return this.redoStack;
  }

  /**
   * Notify listeners of history changes
   */
  private notifyChange(): void {
    if (this.onChange) {
      this.onChange(this);
    }
  }

  /**
   * Get a formatted history timeline for debugging
   */
  getHistoryTimeline(): Array<{
    index: number;
    timestamp: string;
    type: string;
    description: string;
  }> {
    return this.undoStack.map((cmd, index) => ({
      index,
      timestamp: new Date(cmd.timestamp).toLocaleTimeString(),
      type: cmd.type,
      description: cmd.description,
    }));
  }
}
