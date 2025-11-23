/**
 * Command Pattern for Undo/Redo System
 *
 * This module implements the Command pattern for reversible timeline operations.
 * Each command encapsulates a single operation with its before/after state,
 * enabling efficient undo/redo without full project snapshots.
 */

import type { Clip, Track, MediaAssetMeta } from "../types";

/**
 * Base Command interface that all timeline operations must implement
 */
export interface Command {
  /** Unique identifier for this command instance */
  readonly id: string;

  /** Timestamp when the command was created */
  readonly timestamp: number;

  /** Human-readable description of the command for debugging */
  readonly description: string;

  /** Command type for serialization and debugging */
  readonly type: CommandType;

  /**
   * Execute the command, applying changes to the project state
   * @returns true if execution was successful, false otherwise
   */
  execute(): boolean;

  /**
   * Undo the command, reverting changes to the previous state
   * @returns true if undo was successful, false otherwise
   */
  undo(): boolean;

  /**
   * Serialize the command to JSON for potential persistence
   */
  serialize(): SerializedCommand;
}

/**
 * All supported command types in the editor
 */
export type CommandType =
  | "clip:move"
  | "clip:split"
  | "clip:delete"
  | "clip:trim"
  | "clip:add"
  | "clip:ripple-delete"
  | "clip:ripple-trim"
  | "clip:slip-edit"
  | "clip:slide-edit"
  | "clips:delete" // Batch delete multiple clips
  | "clips:move" // Batch move multiple clips
  | "clips:duplicate" // Batch duplicate multiple clips
  | "asset:add"
  | "asset:update"
  | "batch"; // For grouping multiple commands

/**
 * Serialized command data structure
 */
export interface SerializedCommand {
  id: string;
  timestamp: number;
  type: CommandType;
  description: string;
  data: Record<string, unknown>;
}

/**
 * State snapshot for a clip before/after an operation
 */
export interface ClipSnapshot {
  id: string;
  trackId: string;
  start: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  // Include other relevant properties as needed
  opacity?: number;
  volume?: number;
}

/**
 * Create a snapshot of a clip's current state
 */
export function snapshotClip(clip: Clip): ClipSnapshot {
  return {
    id: clip.id,
    trackId: clip.trackId,
    start: clip.start,
    duration: clip.duration,
    trimStart: clip.trimStart,
    trimEnd: clip.trimEnd,
    opacity: clip.opacity,
    volume: clip.volume,
  };
}

/**
 * Abstract base class for commands that provides common functionality
 */
export abstract class BaseCommand implements Command {
  readonly id: string;
  readonly timestamp: number;

  constructor(
    public readonly type: CommandType,
    public readonly description: string,
  ) {
    this.id = `cmd-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
    this.timestamp = Date.now();
  }

  abstract execute(): boolean;
  abstract undo(): boolean;

  serialize(): SerializedCommand {
    return {
      id: this.id,
      timestamp: this.timestamp,
      type: this.type,
      description: this.description,
      data: this.serializeData(),
    };
  }

  /**
   * Subclasses override this to provide command-specific serialization data
   */
  protected abstract serializeData(): Record<string, unknown>;
}

/**
 * Batch command for grouping multiple operations as a single undoable action
 */
export class BatchCommand extends BaseCommand {
  private commands: Command[] = [];

  constructor(description: string) {
    super("batch", description);
  }

  /**
   * Add a command to this batch
   */
  add(command: Command): void {
    this.commands.push(command);
  }

  execute(): boolean {
    for (const command of this.commands) {
      if (!command.execute()) {
        // If any command fails, undo all previously executed commands
        this.undo();
        return false;
      }
    }
    return true;
  }

  undo(): boolean {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      if (!this.commands[i].undo()) {
        return false;
      }
    }
    return true;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      commands: this.commands.map(cmd => cmd.serialize()),
    };
  }
}
