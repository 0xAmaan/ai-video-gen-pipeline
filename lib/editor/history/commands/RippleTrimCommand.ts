import { BaseCommand, ClipSnapshot, snapshotClip } from "../command";
import type { Project, Clip } from "../../types";

/**
 * Command for ripple trimming a clip (trim + shift subsequent clips)
 */
export class RippleTrimCommand extends BaseCommand {
  private beforeSnapshot: ClipSnapshot;
  private affectedClips: Map<string, ClipSnapshot> = new Map();

  constructor(
    private getProject: () => Project | null,
    private setProject: (project: Project) => void,
    private clipId: string,
    private trimStart: number,
    private trimEnd: number,
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
      "clip:ripple-trim",
      `Ripple trim clip ${clipId} (start: ${trimStart.toFixed(2)}s, end: ${trimEnd.toFixed(2)}s)`,
    );

    this.beforeSnapshot = snapshotClip(clip);
  }

  execute(): boolean {
    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);

    for (const sequence of clone.sequences) {
      let targetTrack = null;
      let targetClip = null;

      for (const track of sequence.tracks) {
        const clip = track.clips.find((c) => c.id === this.clipId);
        if (clip) {
          targetTrack = track;
          targetClip = clip;
          break;
        }
      }

      if (!targetClip || !targetTrack) continue;

      // Store snapshots of affected clips
      this.affectedClips.clear();
      targetTrack.clips.forEach((clip) => {
        if (clip.start > targetClip.start) {
          this.affectedClips.set(clip.id, snapshotClip(clip));
        }
      });

      const originalDuration = targetClip.duration;

      // Apply trim
      targetClip.trimStart += this.trimStart;
      targetClip.trimEnd += this.trimEnd;
      targetClip.duration = Math.max(0.1, targetClip.duration - this.trimStart - this.trimEnd);

      const durationDelta = originalDuration - targetClip.duration;

      // Ripple: shift subsequent clips
      if (Math.abs(durationDelta) > 0.001) {
        targetTrack.clips.forEach((clip) => {
          if (clip.id !== this.clipId && clip.start > targetClip.start) {
            clip.start = Math.max(0, clip.start - durationDelta);
          }
        });
        targetTrack.clips.sort((a, b) => a.start - b.start);
      }

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
        // Restore the trimmed clip
        const clip = track.clips.find((c) => c.id === this.clipId);
        if (clip) {
          clip.trimStart = this.beforeSnapshot.trimStart;
          clip.trimEnd = this.beforeSnapshot.trimEnd;
          clip.duration = this.beforeSnapshot.duration;
        }

        // Restore affected clips
        track.clips.forEach((clip) => {
          const snapshot = this.affectedClips.get(clip.id);
          if (snapshot) {
            clip.start = snapshot.start;
          }
        });

        track.clips.sort((a, b) => a.start - b.start);
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
      trimStart: this.trimStart,
      trimEnd: this.trimEnd,
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
