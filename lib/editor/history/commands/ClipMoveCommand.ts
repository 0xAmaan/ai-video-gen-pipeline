import { BaseCommand, ClipSnapshot, snapshotClip } from "../command";
import type { Project, Clip } from "../../types";

/**
 * Command for moving a clip to a different track or timeline position
 */
export class ClipMoveCommand extends BaseCommand {
  private beforeSnapshot: ClipSnapshot;
  private afterSnapshot: ClipSnapshot | null = null;

  constructor(
    private getProject: () => Project | null,
    private setProject: (project: Project) => void,
    private clipId: string,
    private targetTrackId: string,
    private targetStart: number,
  ) {
    const project = getProject();
    if (!project) {
      throw new Error("No project available");
    }

    const clip = findClipInProject(project, clipId);
    if (!clip) {
      throw new Error(`Clip ${clipId} not found`);
    }

    const from = `${clip.trackId}@${clip.start.toFixed(2)}s`;
    const to = `${targetTrackId}@${targetStart.toFixed(2)}s`;
    super("clip:move", `Move clip from ${from} to ${to}`);

    this.beforeSnapshot = snapshotClip(clip);
  }

  execute(): boolean {
    const project = this.getProject();
    if (!project) return false;

    const result = moveClipInProject(
      project,
      this.clipId,
      this.targetTrackId,
      this.targetStart,
    );

    if (!result.success || !result.project) return false;

    this.afterSnapshot = result.snapshot ?? null;
    this.setProject(result.project);
    return true;
  }

  undo(): boolean {
    if (!this.beforeSnapshot) return false;

    const project = this.getProject();
    if (!project) return false;

    const result = moveClipInProject(
      project,
      this.clipId,
      this.beforeSnapshot.trackId,
      this.beforeSnapshot.start,
    );

    if (!result.success || !result.project) return false;

    this.setProject(result.project);
    return true;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      clipId: this.clipId,
      before: this.beforeSnapshot,
      after: this.afterSnapshot,
      targetTrackId: this.targetTrackId,
      targetStart: this.targetStart,
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
 * Helper: Move a clip in a project (immutable operation)
 */
function moveClipInProject(
  project: Project,
  clipId: string,
  targetTrackId: string,
  targetStart: number,
): { success: boolean; project?: Project; snapshot?: ClipSnapshot } {
  const clone = structuredClone(project);

  for (const sequence of clone.sequences) {
    // Find source track and clip
    let sourceTrack = null;
    let clip = null;

    for (const track of sequence.tracks) {
      const found = track.clips.find(c => c.id === clipId);
      if (found) {
        sourceTrack = track;
        clip = found;
        break;
      }
    }

    if (!clip || !sourceTrack) continue;

    // Find target track
    const targetTrack = sequence.tracks.find(t => t.id === targetTrackId);
    if (!targetTrack) {
      return { success: false };
    }

    // Remove from source track if different
    if (sourceTrack.id !== targetTrackId) {
      const index = sourceTrack.clips.findIndex(c => c.id === clipId);
      if (index !== -1) {
        sourceTrack.clips.splice(index, 1);
      }
      targetTrack.clips.push(clip);
    }

    // Update clip properties
    clip.trackId = targetTrackId;
    clip.start = Math.max(0, targetStart);

    // Sort target track clips
    targetTrack.clips.sort((a, b) => a.start - b.start);

    // Update sequence duration
    recalculateSequenceDuration(sequence);

    return {
      success: true,
      project: clone,
      snapshot: snapshotClip(clip),
    };
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
