/**
 * History Debug Panel Component
 *
 * Displays the command history for debugging and development.
 * Shows the last 10 commands with timestamps and allows manual undo/redo.
 */

"use client";

import { useCommandHistory } from "@/lib/editor/hooks/useCommandHistory";

interface HistoryDebugPanelProps {
  /** Whether the panel is visible */
  visible?: boolean;
  /** Maximum number of commands to display */
  maxItems?: number;
}

export function HistoryDebugPanel({
  visible = true,
  maxItems = 10,
}: HistoryDebugPanelProps) {
  const {
    stats,
    undo,
    redo,
    getHistoryTimeline,
    getUndoDescription,
    getRedoDescription,
  } = useCommandHistory();

  if (!visible) return null;

  const timeline = getHistoryTimeline().slice(-maxItems);
  const undoDesc = getUndoDescription();
  const redoDesc = getRedoDescription();

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-zinc-900/95 backdrop-blur border border-zinc-700 rounded-lg shadow-2xl text-xs font-mono z-50">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-700 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-100">History Debug</h3>
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          <span>{stats.undoCount} undo</span>
          <span>•</span>
          <span>{stats.redoCount} redo</span>
        </div>
      </div>

      {/* Stats */}
      <div className="px-3 py-2 border-b border-zinc-700 bg-zinc-800/50 grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <div className="text-zinc-500">Total Commands</div>
          <div className="text-zinc-100 font-medium">{stats.totalCount}</div>
        </div>
        <div>
          <div className="text-zinc-500">Memory Est.</div>
          <div className="text-zinc-100 font-medium">
            {(stats.memoryEstimate / 1024).toFixed(1)} KB
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-b border-zinc-700 flex gap-2">
        <button
          onClick={() => undo()}
          disabled={!stats.canUndo}
          className="flex-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 rounded text-[10px] font-medium transition-colors"
          title={undoDesc || "Nothing to undo"}
        >
          ⌘Z Undo
        </button>
        <button
          onClick={() => redo()}
          disabled={!stats.canRedo}
          className="flex-1 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-600 rounded text-[10px] font-medium transition-colors"
          title={redoDesc || "Nothing to redo"}
        >
          ⌘⇧Z Redo
        </button>
      </div>

      {/* Command Timeline */}
      <div className="max-h-64 overflow-y-auto">
        {timeline.length === 0 ? (
          <div className="px-3 py-8 text-center text-zinc-500 text-[10px]">
            No commands in history
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {timeline.map((item, index) => (
              <div
                key={`${item.index}-${item.timestamp}`}
                className="px-3 py-2 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-zinc-400 flex-shrink-0">
                    #{item.index + 1}
                  </span>
                  <span className="text-zinc-500 text-[9px] flex-shrink-0">
                    {item.timestamp}
                  </span>
                </div>
                <div className="text-zinc-200 mb-0.5">{item.description}</div>
                <div className="text-zinc-500 text-[9px]">
                  <span className="px-1 py-0.5 bg-zinc-800 rounded">
                    {item.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next/Redo hint */}
      {undoDesc && (
        <div className="px-3 py-2 border-t border-zinc-700 bg-emerald-900/20">
          <div className="text-[9px] text-zinc-500 mb-0.5">Next Undo:</div>
          <div className="text-[10px] text-emerald-400">{undoDesc}</div>
        </div>
      )}
      {redoDesc && (
        <div className="px-3 py-2 border-t border-zinc-700 bg-blue-900/20">
          <div className="text-[9px] text-zinc-500 mb-0.5">Next Redo:</div>
          <div className="text-[10px] text-blue-400">{redoDesc}</div>
        </div>
      )}
    </div>
  );
}
