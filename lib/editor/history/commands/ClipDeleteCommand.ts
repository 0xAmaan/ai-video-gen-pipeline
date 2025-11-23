import { BaseCommand, ClipSnapshot, snapshotClip } from "../command";
import type { Project, Clip } from "../../types";

/**
 * Command for deleting a clip from the timeline
 */
export class ClipDeleteCommand extends BaseCommand {
  private deletedClip: ClipSnapshot | null = null;
  private trackId: string | null = null;
  private insertionIndex: number = -1;
  private fullClip: Clip | null = null; // Store full clip for restore

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

    super("clip:delete", `Delete clip ${clipId}`);

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
        const index = track.clips.findIndex(c => c.id === this.clipId);
        if (index !== -1) {
          track.clips.splice(index, 1);
          track.clips.sort((a, b) => a.start - b.start);
          recalculateSequenceDuration(sequence);

          // Update timestamp to trigger EditorController sync
          clone.updatedAt = Date.now();

          this.setProject(clone);
          return true;
        }
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
      const track = sequence.tracks.find(t => t.id === this.trackId);
      if (!track) continue;

      // Restore the clip at its original index
      track.clips.splice(this.insertionIndex, 0, this.fullClip);
      track.clips.sort((a, b) => a.start - b.start);
      recalculateSequenceDuration(sequence);

      // Update timestamp to trigger EditorController sync
      clone.updatedAt = Date.now();

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
      const index = track.clips.findIndex(c => c.id === clipId);
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
