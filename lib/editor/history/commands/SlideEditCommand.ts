import { BaseCommand, ClipSnapshot, snapshotClip } from "../command";
import type { Project, Clip } from "../../types";

/**
 * Command for slide editing a clip (move clip while preserving gaps with adjacent clips)
 */
export class SlideEditCommand extends BaseCommand {
  private beforeSnapshot: ClipSnapshot;
  private affectedClips: Map<string, ClipSnapshot> = new Map();

  constructor(
    private getProject: () => Project | null,
    private setProject: (project: Project) => void,
    private clipId: string,
    private newStart: number, // New start position for the clip
  ) {
    const project = getProject();
    if (!project) {
      throw new Error("No project available");
    }

    const clip = findClipInProject(project, clipId);
    if (!clip) {
      throw new Error(`Clip ${clipId} not found`);
    }

    super(
      "clip:slide-edit",
      `Slide edit clip from ${clip.start.toFixed(2)}s to ${newStart.toFixed(2)}s`,
    );

    this.beforeSnapshot = snapshotClip(clip);
  }

  execute(): boolean {
    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);

    for (const sequence of clone.sequences) {
      const result = findTrackAndClip(sequence, this.clipId);
      if (!result) continue;

      const { track, clip } = result;
      const oldStart = clip.start;
      const delta = this.newStart - oldStart;

      // Clamp to non-negative time
      const clampedStart = Math.max(0, this.newStart);
      clip.start = clampedStart;

      // Store snapshots of affected clips
      this.affectedClips.clear();

      // Slide editing: adjust adjacent clips to preserve gaps
      const sortedClips = [...track.clips].sort((a, b) => a.start - b.start);
      const clipIndex = sortedClips.findIndex(c => c.id === this.clipId);

      if (clipIndex > 0 && delta < 0) {
        // Moving left: shift previous clip to maintain gap
        const prevClip = sortedClips[clipIndex - 1];
        this.affectedClips.set(prevClip.id, snapshotClip(prevClip));

        const gap = oldStart - (prevClip.start + prevClip.duration);
        prevClip.start = Math.max(0, clampedStart - prevClip.duration - gap);
      } else if (clipIndex < sortedClips.length - 1 && delta > 0) {
        // Moving right: shift next clip to maintain gap
        const nextClip = sortedClips[clipIndex + 1];
        this.affectedClips.set(nextClip.id, snapshotClip(nextClip));

        const gap = nextClip.start - (oldStart + clip.duration);
        nextClip.start = clampedStart + clip.duration + gap;
      }

      track.clips.sort((a: Clip, b: Clip) => a.start - b.start);
      recalculateSequenceDuration(sequence);

      this.setProject(clone);
      return true;
    }

    return false;
  }

  undo(): boolean {
    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);

    for (const sequence of clone.sequences) {
      for (const track of sequence.tracks) {
        // Restore the slid clip
        const clip = track.clips.find((c) => c.id === this.clipId);
        if (clip) {
          clip.start = this.beforeSnapshot.start;
        }

        // Restore affected clips
        track.clips.forEach((clip) => {
          const snapshot = this.affectedClips.get(clip.id);
          if (snapshot) {
            clip.start = snapshot.start;
          }
        });

        track.clips.sort((a: Clip, b: Clip) => a.start - b.start);
      }

      recalculateSequenceDuration(sequence);
      this.setProject(clone);
      return true;
    }

    return false;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      clipId: this.clipId,
      newStart: this.newStart,
      before: this.beforeSnapshot,
      affectedClips: Array.from(this.affectedClips.entries()),
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
 * Helper: Find a clip and its track
 */
function findTrackAndClip(sequence: any, clipId: string): { track: any; clip: Clip } | null {
  for (const track of sequence.tracks) {
    const clip = track.clips.find((c: Clip) => c.id === clipId);
    if (clip) {
      return { track, clip };
    }
  }
  return null;
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
