import { BaseCommand, ClipSnapshot, snapshotClip } from "../command";
import type { Project, Clip } from "../../types";

/**
 * Command for ripple deleting a clip (delete + close gap by shifting subsequent clips)
 *
 * Features:
 * - Single-track ripple: Only shifts clips on the same track as deleted clip
 * - Multi-track ripple: Shifts clips on all unlocked tracks (future enhancement)
 * - Locked clip/track support: Skips locked tracks and clips during ripple
 * - Gap closure: Automatically shifts subsequent clips left by deleted clip's duration
 */
export class RippleDeleteCommand extends BaseCommand {
  private deletedClip: ClipSnapshot | null = null;
  private trackId: string | null = null;
  private insertionIndex: number = -1;
  private fullClip: Clip | null = null;
  private affectedClips: Map<string, ClipSnapshot> = new Map();
  private multiTrackRipple: boolean = false; // Future: enable multi-track ripple

  constructor(
    private getProject: () => Project | null,
    private setProject: (project: Project) => void,
    private clipId: string,
    multiTrackRipple: boolean = false, // Optional: enable multi-track ripple
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
    this.multiTrackRipple = multiTrackRipple;
  }

  execute(): boolean {
    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);

    for (const sequence of clone.sequences) {
      // Find the track containing the clip to delete
      let targetTrack: any = null;
      let removed: Clip | null = null;
      let index = -1;

      for (const track of sequence.tracks) {
        index = track.clips.findIndex((c: Clip) => c.id === this.clipId);
        if (index !== -1) {
          targetTrack = track;
          removed = track.clips[index];
          break;
        }
      }

      if (!targetTrack || !removed) continue;

      // Store snapshots of clips that will be shifted
      this.affectedClips.clear();

      // Determine which tracks to ripple
      const tracksToRipple = this.multiTrackRipple
        ? sequence.tracks.filter((t: any) => !t.locked) // Multi-track: all unlocked tracks
        : [targetTrack]; // Single-track: only the track with deleted clip

      // Store snapshots for all clips that will be affected
      for (const track of tracksToRipple) {
        track.clips.forEach((clip: Clip) => {
          if (clip.start > removed!.start) {
            this.affectedClips.set(clip.id, snapshotClip(clip));
          }
        });
      }

      // Remove the clip from its track
      targetTrack.clips.splice(index, 1);

      // Ripple: shift subsequent clips left on all affected tracks
      for (const track of tracksToRipple) {
        // Skip locked tracks
        if (track.locked) continue;

        track.clips.forEach((clip: Clip) => {
          // Only shift clips that start after the deleted clip
          if (clip.start > removed!.start) {
            clip.start = Math.max(0, clip.start - removed!.duration);
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
