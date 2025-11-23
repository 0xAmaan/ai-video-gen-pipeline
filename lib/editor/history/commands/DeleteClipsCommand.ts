import { BaseCommand, ClipSnapshot, snapshotClip } from "../command";
import type { Project, Clip } from "../../types";

/**
 * Command for deleting multiple clips from the timeline (batch operation)
 * Used for multi-clip selection operations
 */
export class DeleteClipsCommand extends BaseCommand {
  private deletedClips: Array<{
    clip: Clip;
    trackId: string;
    index: number;
  }> = [];

  constructor(
    private getProject: () => Project | null,
    private setProject: (project: Project) => void,
    private clipIds: string[],
  ) {
    super("clips:delete", `Delete ${clipIds.length} clips`);

    const project = getProject();
    if (!project) {
      throw new Error("No project available");
    }

    // Find and snapshot all clips before deletion
    for (const clipId of clipIds) {
      const result = findClipWithTrack(project, clipId);
      if (result) {
        this.deletedClips.push({
          clip: structuredClone(result.clip),
          trackId: result.trackId,
          index: result.index,
        });
      }
    }
  }

  execute(): boolean {
    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);

    // Delete all clips
    for (const clipId of this.clipIds) {
      for (const sequence of clone.sequences) {
        for (const track of sequence.tracks) {
          const index = track.clips.findIndex(c => c.id === clipId);
          if (index !== -1) {
            track.clips.splice(index, 1);
          }
        }
      }
    }

    // Sort all tracks and recalculate durations
    for (const sequence of clone.sequences) {
      for (const track of sequence.tracks) {
        track.clips.sort((a, b) => a.start - b.start);
      }
      recalculateSequenceDuration(sequence);
    }

    // Update timestamp to trigger EditorController sync
    clone.updatedAt = Date.now();

    this.setProject(clone);
    return true;
  }

  undo(): boolean {
    if (this.deletedClips.length === 0) return false;

    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);

    // Restore all clips at their original positions
    for (const { clip, trackId, index } of this.deletedClips) {
      for (const sequence of clone.sequences) {
        const track = sequence.tracks.find(t => t.id === trackId);
        if (!track) continue;

        // Restore at original index
        track.clips.splice(index, 0, clip);
      }
    }

    // Sort all affected tracks and recalculate durations
    for (const sequence of clone.sequences) {
      for (const track of sequence.tracks) {
        track.clips.sort((a, b) => a.start - b.start);
      }
      recalculateSequenceDuration(sequence);
    }

    // Update timestamp to trigger EditorController sync
    clone.updatedAt = Date.now();

    this.setProject(clone);
    return true;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      clipIds: this.clipIds,
      deletedClips: this.deletedClips.map(({ clip, trackId, index }) => ({
        clipId: clip.id,
        trackId,
        index,
      })),
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
