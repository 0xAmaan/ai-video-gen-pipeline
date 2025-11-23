/**
 * History Module - Command Pattern Undo/Redo System
 *
 * This module provides a complete undo/redo system using the Command pattern.
 * It's designed to be memory-efficient by storing only the minimal state changes
 * rather than full project snapshots.
 *
 * @example
 * ```typescript
 * import { HistoryManager, ClipMoveCommand } from './history';
 *
 * const history = new HistoryManager({ maxDepth: 50 });
 *
 * const command = new ClipMoveCommand(
 *   getProject,
 *   setProject,
 *   'clip-123',
 *   'track-1',
 *   10.5
 * );
 *
 * history.execute(command); // Execute and add to history
 * history.undo();            // Undo the command
 * history.redo();            // Redo the command
 * ```
 */

// Core exports
export { HistoryManager } from "./HistoryManager";
export type { HistoryManagerConfig, HistoryStats } from "./HistoryManager";

// Command pattern exports
export type {
  Command,
  CommandType,
  SerializedCommand,
  ClipSnapshot,
} from "./command";

export {
  BaseCommand,
  BatchCommand,
  snapshotClip,
} from "./command";

// Concrete command implementations
export {
  ClipMoveCommand,
  ClipSplitCommand,
  ClipDeleteCommand,
  ClipTrimCommand,
  ClipAddCommand,
  RippleTrimCommand,
  SlipEditCommand,
  SlideEditCommand,
  RippleDeleteCommand,
} from "./commands";
