"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { KonvaTimeline } from "./KonvaTimeline";
import { useProjectStore } from "@/lib/editor/core/project-store";
import { useSnapManager } from "@/lib/editor/hooks/useSnapManager";
import type { Clip, Sequence } from "@/lib/editor/types";

const findClipAndTrack = (sequence: Sequence, clipId: string) => {
  for (const track of sequence.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { clip, track };
  }
  return null;
};

export const LegacyEditorController = () => {
  const project = useProjectStore((state) => state.project);
  const selection = useProjectStore((state) => state.selection);
  const actions = useProjectStore((state) => state.actions);
  const isPlaying = useProjectStore((state) => state.isPlaying);
  const currentTime = useProjectStore((state) => state.currentTime);
  const rippleEditEnabled = useProjectStore((state) => state.rippleEditEnabled);
  const [containerWidth, setContainerWidth] = useState(1200);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get beat markers and snap settings from audio analysis
  const { beatMarkers, snapEnabled } = useSnapManager();

  const sequence = useMemo(
    () =>
      project?.sequences.find(
        (seq) => seq.id === project.settings.activeSequenceId,
      ) ?? project?.sequences[0],
    [project],
  );

  const assets = useMemo(
    () => (project ? Object.values(project.mediaAssets) : []),
    [project],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!project || !sequence) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No sequence loaded
      </div>
    );
  }

  const handleMove = (clipId: string, newStart: number) => {
    const located = findClipAndTrack(sequence, clipId);
    if (!located) return;
    actions.moveClip(clipId, located.track.id, newStart);
  };

  const handleTrim = (clipId: string, newTrimStart: number, newTrimEnd: number) => {
    const located = findClipAndTrack(sequence, clipId);
    if (!located) return;
    const { clip } = located;
    const deltaStart = newTrimStart - clip.trimStart;
    const deltaEnd = newTrimEnd - clip.trimEnd;
    
    if (rippleEditEnabled) {
      actions.rippleTrim(clipId, deltaStart, deltaEnd);
    } else {
      actions.trimClip(clipId, deltaStart, deltaEnd);
    }
  };

  const handleReorder = (clips: Clip[]) => {
    // Reorder clips within their tracks to match provided order.
    const nextProject = structuredClone(project);
    const seq =
      nextProject.sequences.find((seq) => seq.id === nextProject.settings.activeSequenceId) ??
      nextProject.sequences[0];
    if (!seq) return;
    const clipsById = new Map(clips.map((c) => [c.id, c]));
    seq.tracks.forEach((track) => {
      track.clips = track.clips
        .map((clip) => clipsById.get(clip.id) ?? clip)
        .sort((a, b) => a.start - b.start);
    });
    void actions.loadProject(nextProject, { persist: true });
  };

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden bg-background">
      <KonvaTimeline
        sequence={sequence}
        selectedClipId={selection.clipIds[0] ?? null}
        selectedClipIds={selection.clipIds}
        currentTime={currentTime}
        isPlaying={isPlaying}
        containerWidth={containerWidth}
        assets={assets}
        onClipSelect={(clipId) => actions.setSelection({ clipIds: [clipId], trackIds: [] })}
        onClipMultiSelect={(clipIds) => actions.setSelection({ clipIds, trackIds: [] })}
        onClipMove={handleMove}
        onClipReorder={handleReorder}
        onClipTrim={handleTrim}
        onSeek={(time) => actions.setCurrentTime(time)}
        onScrub={(time) => actions.setCurrentTime(time)}
        onScrubStart={() => actions.togglePlayback(false)}
        onScrubEnd={() => undefined}
        beatMarkers={beatMarkers}
        snapToBeats={snapEnabled}
        magneticSnapEnabled
        magneticSnapThreshold={0.1}
      />
    </div>
  );
};

export default LegacyEditorController;

