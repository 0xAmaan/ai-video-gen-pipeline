"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { useTimelineStore } from "@/lib/remotion/timelineStore";
import { TimelineComposition } from "./TimelineComposition";
import { DraggableTimelineBar } from "./DraggableTimelineBar";
import { MediaImport } from "./MediaImport";

/**
 * Minimal Remotion-based editor view:
 * - Renders the current timeline with Remotion Player (scrubbing/controls built-in)
 * - Shows a simple list of clips for clarity
 */
export const RemotionEditor = () => {
  const { tracks, width, height, fps, durationInFrames, actions, selectedClipId } = useTimelineStore();
  const playerRef = useRef<PlayerRef>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const selectedClip = useMemo(
    () => tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId),
    [tracks, selectedClipId],
  );

  const timeline = useMemo(
    () => ({ tracks, width, height, fps, durationInFrames, selectedClipId }),
    [tracks, width, height, fps, durationInFrames, selectedClipId],
  );

  const handleSeek = (frame: number) => {
    const clamped = Math.max(0, Math.min(durationInFrames, frame));
    playerRef.current?.seekTo(clamped);
    setCurrentFrame(clamped);
  };

  // Clamp current frame when timeline duration shrinks
  useEffect(() => {
    if (!playerRef.current) return;
    if (currentFrame > durationInFrames) {
      const clamped = durationInFrames;
      playerRef.current.seekTo(clamped);
      setCurrentFrame(clamped);
    }
  }, [durationInFrames, currentFrame]);

  // Keyboard delete/backspace to remove selected clip
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Backspace" || e.key === "Delete") && selectedClipId) {
        e.preventDefault();
        actions.deleteClip(selectedClipId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedClipId, actions]);

  return (
    <div className="flex flex-col min-h-screen overflow-y-auto">
      <div className="flex flex-row gap-4 p-4">
        {/* Left: import and clip list (scrollable) */}
        <div className="w-[320px] border border-border bg-background rounded-lg min-h-[420px] max-h-[540px] overflow-y-auto p-3">
          <MediaImport />
          <div className="border border-border rounded-lg bg-card p-3 mt-4">
            <div className="text-sm font-medium mb-2">Clips</div>
            <div className="grid grid-cols-2 gap-2">
              {tracks.flatMap((track) =>
                track.clips.map((clip) => (
                  <button
                    key={clip.id}
                    className={`flex flex-col rounded border ${
                      selectedClipId === clip.id ? "border-primary" : "border-border"
                    } overflow-hidden bg-muted/30 text-left`}
                    onClick={() => actions.selectClip(clip.id)}
                    title={clip.name ?? clip.id}
                  >
                    <video
                      src={clip.assetUrl}
                      className="w-full aspect-video object-cover bg-black"
                      muted
                      preload="metadata"
                    />
                    <div className="px-2 py-1 text-xs truncate">{clip.name ?? clip.id}</div>
                  </button>
                )),
              )}
            </div>
          </div>
        </div>

        {/* Right: player */}
        <div className="flex-1">
          <div className="border border-border rounded-lg bg-card p-2">
            <div className="w-full" style={{ height: "360px" }}>
              <Player
                ref={playerRef}
                component={TimelineComposition}
                inputProps={{ timeline }}
                durationInFrames={durationInFrames}
                compositionWidth={width}
                compositionHeight={height}
                fps={fps}
                controls
                style={{ width: "100%", height: "100%", background: "black" }}
                onFrameUpdate={(e) => setCurrentFrame(e.frame)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Clip properties */}
      <div className="border-t border-border bg-background p-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="font-medium">Tracks</span>
            {tracks.map((track) => (
              <div key={track.id} className="flex items-center gap-2 text-xs border border-border rounded px-2 py-1">
                <span>{track.name}</span>
                <button
                  className={`px-2 py-1 rounded ${track.muted ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}
                  onClick={() =>
                    actions.setTimeline({
                      tracks: tracks.map((t) => (t.id === track.id ? { ...t, muted: !t.muted } : t)),
                    })
                  }
                >
                  {track.muted ? "Unmute" : "Mute"}
                </button>
                <button
                  className={`px-2 py-1 rounded ${track.locked ? "bg-muted text-foreground" : "bg-secondary text-secondary-foreground"}`}
                  onClick={() =>
                    actions.setTimeline({
                      tracks: tracks.map((t) => (t.id === track.id ? { ...t, locked: !t.locked } : t)),
                    })
                  }
                >
                  {track.locked ? "Unlock" : "Lock"}
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {selectedClip ? (
              <>
                <div className="text-sm">
                  <div className="font-medium">{selectedClip.name ?? selectedClip.id}</div>
                  <div className="text-xs text-muted-foreground">
                    Start {selectedClip.startFrame}f • Dur {selectedClip.durationInFrames}f
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <label className="text-xs text-muted-foreground">Opacity</label>
                  <input
                    type="number"
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-sm"
                    value={selectedClip.opacity ?? 1}
                    step={0.1}
                    min={0}
                    max={1}
                    onChange={(e) =>
                      actions.updateClip(selectedClip.id, {
                        opacity: Math.max(0, Math.min(1, Number(e.target.value) || 0)),
                      })
                    }
                  />
                  <label className="text-xs text-muted-foreground">Volume</label>
                  <input
                    type="number"
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-sm"
                    value={selectedClip.volume ?? 1}
                    step={0.1}
                    min={0}
                    onChange={(e) =>
                      actions.updateClip(selectedClip.id, {
                        volume: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                  <label className="text-xs text-muted-foreground">Fade in (f)</label>
                  <input
                    type="number"
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-sm"
                    value={selectedClip.fadeInFrames ?? 0}
                    onChange={(e) =>
                      actions.updateClip(selectedClip.id, { fadeInFrames: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                  <label className="text-xs text-muted-foreground">Fade out (f)</label>
                  <input
                    type="number"
                    className="w-16 rounded border border-border bg-background px-2 py-1 text-sm"
                    value={selectedClip.fadeOutFrames ?? 0}
                    onChange={(e) =>
                      actions.updateClip(selectedClip.id, { fadeOutFrames: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Select a clip to edit properties.</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: timeline */}
      <div className="border-t border-border bg-background p-3 overflow-x-auto flex-shrink-0" style={{ height: "200px" }}>
        <DraggableTimelineBar
          tracks={tracks}
          fps={fps}
          durationInFrames={durationInFrames}
          currentFrame={currentFrame}
          onSeek={handleSeek}
          selectedClipId={selectedClipId}
          onSelectClip={(id) => actions.selectClip(id)}
          onUpdateClip={(clipId, updates) => actions.updateClip(clipId, updates)}
        />
      </div>
    </div>
  );
};
