import { BaseCommand } from "../command";
import type { Project, Clip } from "../../types";

/**
 * Command for duplicating multiple clips on the timeline (batch operation)
 * Used for multi-clip duplication operations
 */
export class DuplicateClipsCommand extends BaseCommand {
  private duplicatedClipIds: string[] = [];
  private originalClips: Array<{
    clip: Clip;
    trackId: string;
  }> = [];

  constructor(
    private getProject: () => Project | null,
    private setProject: (project: Project) => void,
    private clipIds: string[],
  ) {
    super("clips:duplicate", `Duplicate ${clipIds.length} clip${clipIds.length > 1 ? 's' : ''}`);

    const project = getProject();
    if (!project) {
      throw new Error("No project available");
    }

    // Find and snapshot all clips before duplication
    for (const clipId of clipIds) {
      const result = findClipWithTrack(project, clipId);
      if (result) {
        this.originalClips.push({
          clip: structuredClone(result.clip),
          trackId: result.trackId,
        });
      }
    }
  }

  execute(): boolean {
    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);
    this.duplicatedClipIds = [];

    // Duplicate all clips
    for (const { clip: originalClip, trackId } of this.originalClips) {
      for (const sequence of clone.sequences) {
        const track = sequence.tracks.find(t => t.id === trackId);
        if (!track) continue;

        // Create new clip with unique ID, positioned after original
        const newClip: Clip = {
          ...structuredClone(originalClip),
          id: `clip-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
          start: originalClip.start + originalClip.duration,
        };

        // Add the duplicated clip to the track
        track.clips.push(newClip);
        this.duplicatedClipIds.push(newClip.id);
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
    console.log('[DuplicateClipsCommand] Duplicated clips:', this.duplicatedClipIds);
    return true;
  }

  undo(): boolean {
    if (this.duplicatedClipIds.length === 0) return false;

    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);

    // Remove all duplicated clips
    for (const clipId of this.duplicatedClipIds) {
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
    console.log('[DuplicateClipsCommand] Undid duplication of:', this.duplicatedClipIds);
    return true;
  }

  /**
   * Get the IDs of the newly duplicated clips (for selection after execution)
   */
  getDuplicatedClipIds(): string[] {
    return [...this.duplicatedClipIds];
  }

  protected serializeData(): Record<string, unknown> {
    return {
      clipIds: this.clipIds,
      duplicatedClipIds: this.duplicatedClipIds,
      originalClips: this.originalClips.map(({ clip, trackId }) => ({
        clipId: clip.id,
        trackId,
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
): { clip: Clip; trackId: string } | null {
  for (const sequence of project.sequences) {
    for (const track of sequence.tracks) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) {
        return {
          clip,
          trackId: track.id,
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
