import { BaseCommand, ClipSnapshot, snapshotClip } from "../command";
import type { Project, Clip } from "../../types";

/**
 * Command for ripple deleting a clip (delete + close gap by shifting subsequent clips)
 */
export class RippleDeleteCommand extends BaseCommand {
  private deletedClip: ClipSnapshot | null = null;
  private trackId: string | null = null;
  private insertionIndex: number = -1;
  private fullClip: Clip | null = null;
  private affectedClips: Map<string, ClipSnapshot> = new Map();

  constructor(
    private getProject: () => Project | null,
    private setProject: (project: Project) => void,
    private clipId: string,
  ) {
    const project = getProject();
    if (!project) {
      throw new Error("No project available");
    }

    const result = findClipWithTrack(project, clipId);
    if (!result) {
      throw new Error(`Clip ${clipId} not found`);
    }

    super("clip:ripple-delete", `Ripple delete clip ${clipId}`);

    this.deletedClip = snapshotClip(result.clip);
    this.trackId = result.trackId;
    this.fullClip = structuredClone(result.clip);
    this.insertionIndex = result.index;
  }

  execute(): boolean {
    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);

    for (const sequence of clone.sequences) {
      for (const track of sequence.tracks) {
        const index = track.clips.findIndex((c: Clip) => c.id === this.clipId);
        if (index === -1) continue;

        const removed = track.clips[index];

        // Store snapshots of clips that will be shifted
        this.affectedClips.clear();
        track.clips.forEach((clip: Clip) => {
          if (clip.start > removed.start) {
            this.affectedClips.set(clip.id, snapshotClip(clip));
          }
        });

        // Remove the clip
        track.clips.splice(index, 1);

        // Ripple: shift subsequent clips left
        track.clips.forEach((clip: Clip) => {
          if (clip.start > removed.start) {
            clip.start = Math.max(0, clip.start - removed.duration);
          }
        });

        track.clips.sort((a, b) => a.start - b.start);
        recalculateSequenceDuration(sequence);

        this.setProject(clone);
        return true;
      }
    }

    return false;
  }

  undo(): boolean {
    if (!this.fullClip || !this.trackId) return false;

    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);

    for (const sequence of clone.sequences) {
      const track = sequence.tracks.find((t: any) => t.id === this.trackId);
      if (!track) continue;

      // Restore affected clips first
      track.clips.forEach((clip: Clip) => {
        const snapshot = this.affectedClips.get(clip.id);
        if (snapshot) {
          clip.start = snapshot.start;
        }
      });

      // Restore the deleted clip at its original index
      track.clips.splice(this.insertionIndex, 0, this.fullClip);
      track.clips.sort((a, b) => a.start - b.start);
      recalculateSequenceDuration(sequence);

      this.setProject(clone);
      return true;
    }

    return false;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      clipId: this.clipId,
      deletedClip: this.deletedClip,
      trackId: this.trackId,
      insertionIndex: this.insertionIndex,
      affectedClips: Array.from(this.affectedClips.entries()),
    };
  }
}

/**
 * Helper: Find a clip and its track in the project
 */
function findClipWithTrack(
  project: Project,
  clipId: string,
): { clip: Clip; trackId: string; index: number } | null {
  for (const sequence of project.sequences) {
    for (const track of sequence.tracks) {
      const index = track.clips.findIndex((c) => c.id === clipId);
      if (index !== -1) {
        return {
          clip: track.clips[index],
          trackId: track.id,
          index,
        };
      }
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
