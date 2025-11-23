import { BaseCommand, ClipSnapshot, snapshotClip } from "../command";
import type { Project, Clip } from "../../types";

/**
 * Command for moving multiple clips together (batch operation)
 * Maintains relative positions between clips when moving as a group
 */
export class MoveClipsCommand extends BaseCommand {
  private beforeSnapshots: Map<string, ClipSnapshot> = new Map();
  private afterSnapshots: Map<string, ClipSnapshot> = new Map();

  constructor(
    private getProject: () => Project | null,
    private setProject: (project: Project) => void,
    private clipIds: string[],
    private timeOffset: number, // How much to shift all clips in time
    private trackOffset?: number, // How many tracks to shift (optional)
  ) {
    super("clips:move", `Move ${clipIds.length} clips`);

    const project = getProject();
    if (!project) {
      throw new Error("No project available");
    }

    // Snapshot all clips before moving
    for (const clipId of clipIds) {
      const clip = findClipInProject(project, clipId);
      if (clip) {
        this.beforeSnapshots.set(clipId, snapshotClip(clip));
      }
    }
  }

  execute(): boolean {
    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);
    const sequence = clone.sequences[0]; // Assuming single sequence for now
    if (!sequence) return false;

    // Get track ordering for track offset calculations
    const trackOrder = sequence.tracks.map(t => t.id);

    // Move all clips
    for (const clipId of this.clipIds) {
      const result = findClipWithTrack(clone, clipId);
      if (!result) continue;

      const { clip, trackId } = result;

      // Calculate new start time
      const newStart = Math.max(0, clip.start + this.timeOffset);

      // Calculate new track if track offset is specified
      let newTrackId = trackId;
      if (this.trackOffset !== undefined) {
        const currentTrackIndex = trackOrder.indexOf(trackId);
        const newTrackIndex = Math.max(
          0,
          Math.min(trackOrder.length - 1, currentTrackIndex + this.trackOffset)
        );
        newTrackId = trackOrder[newTrackIndex];
      }

      // Find source and target tracks
      const sourceTrack = sequence.tracks.find(t => t.id === trackId);
      const targetTrack = sequence.tracks.find(t => t.id === newTrackId);

      if (!sourceTrack || !targetTrack) continue;

      // CapCut-style: No track compatibility restrictions - any clip can go anywhere

      // Remove from source track if moving to different track
      if (sourceTrack.id !== targetTrack.id) {
        const index = sourceTrack.clips.findIndex(c => c.id === clipId);
        if (index !== -1) {
          sourceTrack.clips.splice(index, 1);
          targetTrack.clips.push(clip);
        }
      }

      // Update clip position and track
      clip.start = newStart;
      clip.trackId = newTrackId;

      // Snapshot after state
      this.afterSnapshots.set(clipId, snapshotClip(clip));
    }

    // Sort all affected tracks
    for (const track of sequence.tracks) {
      track.clips.sort((a, b) => a.start - b.start);
    }

    recalculateSequenceDuration(sequence);

    // Update timestamp to trigger EditorController sync
    clone.updatedAt = Date.now();

    this.setProject(clone);
    return true;
  }

  undo(): boolean {
    if (this.beforeSnapshots.size === 0) return false;

    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);
    const sequence = clone.sequences[0];
    if (!sequence) return false;

    // Restore all clips to before state
    for (const [clipId, snapshot] of this.beforeSnapshots) {
      const result = findClipWithTrack(clone, clipId);
      if (!result) continue;

      const { clip, trackId } = result;
      const originalTrackId = snapshot.trackId;

      // Find source and target tracks
      const sourceTrack = sequence.tracks.find(t => t.id === trackId);
      const targetTrack = sequence.tracks.find(t => t.id === originalTrackId);

      if (!sourceTrack || !targetTrack) continue;

      // Remove from current track if different
      if (sourceTrack.id !== targetTrack.id) {
        const index = sourceTrack.clips.findIndex(c => c.id === clipId);
        if (index !== -1) {
          sourceTrack.clips.splice(index, 1);
          targetTrack.clips.push(clip);
        }
      }

      // Restore original position and track
      clip.start = snapshot.start;
      clip.trackId = snapshot.trackId;
    }

    // Sort all affected tracks
    for (const track of sequence.tracks) {
      track.clips.sort((a, b) => a.start - b.start);
    }

    recalculateSequenceDuration(sequence);

    // Update timestamp to trigger EditorController sync
    clone.updatedAt = Date.now();

    this.setProject(clone);
    return true;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      clipIds: this.clipIds,
      timeOffset: this.timeOffset,
      trackOffset: this.trackOffset,
      before: Array.from(this.beforeSnapshots.entries()),
      after: Array.from(this.afterSnapshots.entries()),
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
