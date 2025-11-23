"use client";

import { useMemo, useRef, useState } from "react";
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

  const timeline = useMemo(
    () => ({ tracks, width, height, fps, durationInFrames, selectedClipId }),
    [tracks, width, height, fps, durationInFrames, selectedClipId],
  );

  const handleSeek = (frame: number) => {
    const clamped = Math.max(0, Math.min(durationInFrames, frame));
    playerRef.current?.seekTo(clamped);
    setCurrentFrame(clamped);
  };

  return (
    <div className="flex flex-col min-h-[85vh]">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: import and clip list (scrollable) */}
        <div className="w-[340px] border-r border-border bg-background min-h-0 overflow-y-auto p-3">
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
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <div className="border border-border rounded-lg bg-card h-full flex items-center justify-center">
            <Player
              ref={playerRef}
              component={TimelineComposition}
              inputProps={{ timeline }}
              durationInFrames={durationInFrames}
              compositionWidth={width}
              compositionHeight={height}
              fps={fps}
              controls
              style={{ width: "100%", height: "55vh", background: "black" }}
              onFrameUpdate={(e) => setCurrentFrame(e.frame)}
            />
          </div>
        </div>
      </div>

      {/* Bottom: timeline */}
      <div className="border-t border-border bg-background p-3 overflow-x-auto">
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
