import { BaseCommand, ClipSnapshot, snapshotClip } from "../command";
import type { Project, Clip } from "../../types";

/**
 * Command for splitting a clip at a specific offset
 */
export class ClipSplitCommand extends BaseCommand {
  private beforeSnapshot: ClipSnapshot;
  private leftClipId: string;
  private rightClipId: string;
  private trackId: string;

  constructor(
    private getProject: () => Project | null,
    private setProject: (project: Project) => void,
    private clipId: string,
    private offset: number, // Offset from clip start where split occurs
  ) {
    const project = getProject();
    if (!project) {
      throw new Error("No project available");
    }

    const clip = findClipInProject(project, clipId);
    if (!clip) {
      throw new Error(`Clip ${clipId} not found`);
    }

    super("clip:split", `Split clip at ${offset.toFixed(2)}s`);

    this.beforeSnapshot = snapshotClip(clip);
    this.leftClipId = clipId; // Original clip becomes left part
    this.rightClipId = `${clipId}_split_${Date.now()}`; // Generate ID for right part
    this.trackId = clip.trackId;
  }

  execute(): boolean {
    const project = this.getProject();
    if (!project) return false;

    const result = splitClipInProject(
      project,
      this.clipId,
      this.offset,
      this.rightClipId,
    );

    if (!result.success || !result.project) return false;

    this.setProject(result.project);
    return true;
  }

  undo(): boolean {
    const project = this.getProject();
    if (!project) return false;

    // To undo a split, we need to:
    // 1. Delete the right clip
    // 2. Restore the left clip to its original state

    const clone = structuredClone(project);

    for (const sequence of clone.sequences) {
      for (const track of sequence.tracks) {
        if (track.id !== this.trackId) continue;

        // Remove the right clip
        const rightIndex = track.clips.findIndex(c => c.id === this.rightClipId);
        if (rightIndex !== -1) {
          track.clips.splice(rightIndex, 1);
        }

        // Restore the left clip
        const leftClip = track.clips.find(c => c.id === this.leftClipId);
        if (leftClip) {
          leftClip.start = this.beforeSnapshot.start;
          leftClip.duration = this.beforeSnapshot.duration;
          leftClip.trimStart = this.beforeSnapshot.trimStart;
          leftClip.trimEnd = this.beforeSnapshot.trimEnd;
        }

        track.clips.sort((a, b) => a.start - b.start);
        recalculateSequenceDuration(sequence);

        this.setProject(clone);
        return true;
      }
    }

    return false;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      clipId: this.clipId,
      offset: this.offset,
      before: this.beforeSnapshot,
      leftClipId: this.leftClipId,
      rightClipId: this.rightClipId,
      trackId: this.trackId,
    };
  }
}

/**
 * Helper: Find a clip in the project
 */
function findClipInProject(project: Project, clipId: string): Clip | null {
  for (const sequence of project.sequences) {
    for (const track of sequence.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) return clip;
    }
  }
  return null;
}

/**
 * Helper: Split a clip in a project (immutable operation)
 */
function splitClipInProject(
  project: Project,
  clipId: string,
  offset: number,
  rightClipId: string,
): { success: boolean; project?: Project } {
  const clone = structuredClone(project);

  for (const sequence of clone.sequences) {
    for (const track of sequence.tracks) {
      const index = track.clips.findIndex(c => c.id === clipId);
      if (index === -1) continue;

      const originalClip = track.clips[index];

      // Create right clip (new clip after split point)
      const rightClip: Clip = {
        ...originalClip,
        id: rightClipId,
        start: originalClip.start + offset,
        duration: Math.max(0.1, originalClip.duration - offset),
        trimStart: originalClip.trimStart + offset,
      };

      // Modify left clip (original clip, now shorter)
      originalClip.duration = offset;
      originalClip.trimEnd = Math.max(0, originalClip.trimEnd - rightClip.duration);

      // Insert right clip after left clip
      track.clips.splice(index + 1, 0, rightClip);

      track.clips.sort((a, b) => a.start - b.start);
      recalculateSequenceDuration(sequence);

      return { success: true, project: clone };
    }
  }

  return { success: false };
}

/**
 * Helper: Recalculate sequence duration
 */
function recalculateSequenceDuration(sequence: any): void {
  const duration = sequence.tracks.reduce((max: number, track: any) => {
    const trackEnd = track.clips.reduce(
      (trackMax: number, clip: any) => Math.max(trackMax, clip.start + clip.duration),
      0,
    );
    return Math.max(max, trackEnd);
  }, 0);
  sequence.duration = duration;
}
