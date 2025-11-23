import { BaseCommand, ClipSnapshot, snapshotClip } from "../command";
import type { Project, Clip } from "../../types";

/**
 * Command for slip editing a clip (adjust content offset while keeping timeline position fixed)
 */
export class SlipEditCommand extends BaseCommand {
  private beforeSnapshot: ClipSnapshot;

  constructor(
    private getProject: () => Project | null,
    private setProject: (project: Project) => void,
    private clipId: string,
    private offset: number, // Offset to slip the content by
  ) {
    const project = getProject();
    if (!project) {
      throw new Error("No project available");
    }

    const clip = findClipInProject(project, clipId);
    if (!clip) {
      throw new Error(`Clip ${clipId} not found`);
    }

    super("clip:slip-edit", `Slip edit clip by ${offset.toFixed(2)}s`);

    this.beforeSnapshot = snapshotClip(clip);
  }

  execute(): boolean {
    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);

    for (const sequence of clone.sequences) {
      for (const track of sequence.tracks) {
        const clip = track.clips.find((c) => c.id === this.clipId);
        if (!clip) continue;

        // Get source media to validate bounds
        const asset = clone.mediaAssets[clip.mediaId];
        if (!asset) {
          console.warn('[SlipEditCommand] execute: asset not found:', clip.mediaId);
          return false;
        }

        // Slip editing: adjust trim start/end while keeping timeline position fixed
        const newTrimStart = clip.trimStart + this.offset;

        // Ensure we don't slip beyond source media bounds
        const maxTrimStart = asset.duration - clip.duration;
        const clampedTrimStart = Math.max(0, Math.min(maxTrimStart, newTrimStart));

        // Calculate the actual offset applied after clamping
        const actualOffset = clampedTrimStart - clip.trimStart;

        // Update trim values
        clip.trimStart = clampedTrimStart;
        clip.trimEnd = clip.trimEnd - actualOffset; // Adjust trim end to maintain duration

        // Timeline position (start) and duration remain unchanged

        recalculateSequenceDuration(sequence);
        this.setProject(clone);
        return true;
      }
    }

    return false;
  }

  undo(): boolean {
    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);

    for (const sequence of clone.sequences) {
      for (const track of sequence.tracks) {
        const clip = track.clips.find((c) => c.id === this.clipId);
        if (!clip) continue;

        // Restore original trim values
        clip.trimStart = this.beforeSnapshot.trimStart;
        clip.trimEnd = this.beforeSnapshot.trimEnd;
        clip.duration = this.beforeSnapshot.duration;

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
