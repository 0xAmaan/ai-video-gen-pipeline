import type { Project, Track, Clip } from "@/lib/editor/types";
import type { TimelineTrack, MediaElement } from "./types/timeline";
import type { TProject } from "./types/project";

const cloneProject = (project: Project): Project => ({
  ...project,
  sequences: project.sequences.map((sequence) => ({
    ...sequence,
    tracks: sequence.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => ({ ...clip })),
    })),
  })),
  mediaAssets: { ...project.mediaAssets },
});

const clipEnd = (clip: Clip): number => clip.start + clip.duration;

const deriveTrackName = (kind: Track["kind"], index: number): string => {
  if (kind === "audio") {
    return `Audio ${index}`;
  }
  return `Video ${index}`;
};

const asMediaElement = (
  element: TimelineTrack["elements"][number],
): element is MediaElement => element.type === "media";

interface BuildProjectFromTimelineParams {
  baseProject: Project;
  timeline: TimelineTrack[];
  projectMeta: TProject;
}

export const buildProjectFromTimeline = ({
  baseProject,
  timeline,
  projectMeta,
}: BuildProjectFromTimelineParams): Project => {
  if (!baseProject.sequences.length || !timeline.length) {
    return cloneProject(baseProject);
  }

  const nextProject = cloneProject(baseProject);
  nextProject.title = projectMeta.name ?? nextProject.title;
  nextProject.updatedAt = Date.now();

  const activeSequenceId =
    nextProject.settings.activeSequenceId ?? nextProject.sequences[0]?.id;
  const sequenceIndex = nextProject.sequences.findIndex(
    (sequence) => sequence.id === activeSequenceId,
  );
  const sequence =
    sequenceIndex >= 0
      ? nextProject.sequences[sequenceIndex]
      : nextProject.sequences[0];

  if (!sequence) {
    return nextProject;
  }

  const previousTracks = new Map(sequence.tracks.map((track) => [track.id, track]));
  const previousClips = new Map<string, Clip>();
  sequence.tracks.forEach((track) => {
    track.clips.forEach((clip) => {
      previousClips.set(clip.id, clip);
    });
  });

  let videoTrackCount = 0;
  let audioTrackCount = 0;

  const updatedTracks: Track[] = timeline.map((timelineTrack) => {
    const kind: Track["kind"] = timelineTrack.type === "audio" ? "audio" : "video";
    if (kind === "video") {
      videoTrackCount += 1;
    } else {
      audioTrackCount += 1;
    }

    const existing = previousTracks.get(timelineTrack.id);
    const derivedName =
      existing?.name ??
      timelineTrack.name ??
      deriveTrackName(kind, kind === "audio" ? audioTrackCount : videoTrackCount);

    const baseTrack: Track = {
      id: timelineTrack.id,
      name: derivedName,
      kind,
      allowOverlap: kind !== "video",
      locked: existing?.locked ?? false,
      muted: typeof timelineTrack.muted === "boolean"
        ? timelineTrack.muted
        : existing?.muted ?? false,
      solo: existing?.solo ?? false,
      volume: existing?.volume ?? 1,
      zIndex:
        kind === "video"
          ? videoTrackCount - 1
          : existing?.zIndex ?? 0,
      height: existing?.height ?? (kind === "audio" ? 80 : 120),
      visible: existing?.visible ?? true,
      clips: [],
    };

    const nextClips: Clip[] = timelineTrack.elements
      .filter(asMediaElement)
      .map<Clip>((element) => {
        const baseClip = previousClips.get(element.id);
        const hidden = (element as { hidden?: boolean }).hidden ?? false;
        return {
          id: element.id,
          mediaId: element.mediaId,
          trackId: baseTrack.id,
          kind: kind === "audio" ? "audio" : "video",
          start: element.startTime,
          duration: element.duration,
          trimStart: element.trimStart,
          trimEnd: element.trimEnd,
          opacity:
            kind === "audio"
              ? 1
              : hidden
                ? 0
                : baseClip?.opacity ?? 1,
          volume: baseClip?.volume ?? 1,
          effects: baseClip?.effects ?? [],
          transitions: baseClip?.transitions ?? [],
          speedCurve: baseClip?.speedCurve ?? null,
          preservePitch: baseClip?.preservePitch ?? true,
          blendMode: baseClip?.blendMode ?? "normal",
          linkedClipId: baseClip?.linkedClipId,
          originalMediaId: baseClip?.originalMediaId,
        };
      });

    baseTrack.clips = nextClips;
    return baseTrack;
  });

  sequence.tracks = updatedTracks;
  const longestClipEnd = updatedTracks.reduce((maxEnd, track) => {
    const trackEnd = track.clips.reduce((trackMax, clip) => Math.max(trackMax, clipEnd(clip)), 0);
    return Math.max(maxEnd, trackEnd);
  }, 0);

  sequence.duration = Math.max(sequence.duration, longestClipEnd);
  nextProject.settings.activeSequenceId = sequence.id;
  return nextProject;
};
