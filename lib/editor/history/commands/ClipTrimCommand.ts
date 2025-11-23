import { BaseCommand, ClipSnapshot, snapshotClip } from "../command";
import type { Project, Clip } from "../../types";

/**
 * Command for trimming a clip (adjusting in/out points)
 */
export class ClipTrimCommand extends BaseCommand {
  private beforeSnapshot: ClipSnapshot;

  constructor(
    private getProject: () => Project | null,
    private setProject: (project: Project) => void,
    private clipId: string,
    private trimStart: number, // Amount to trim from start (positive = trim in)
    private trimEnd: number,   // Amount to trim from end (positive = trim in)
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
      "clip:trim",
      `Trim clip ${clipId} (start: ${trimStart.toFixed(2)}s, end: ${trimEnd.toFixed(2)}s)`,
    );

    this.beforeSnapshot = snapshotClip(clip);
  }

  execute(): boolean {
    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);

    for (const sequence of clone.sequences) {
      for (const track of sequence.tracks) {
        const clip = track.clips.find(c => c.id === this.clipId);
        if (!clip) continue;

        // Apply trim
        clip.trimStart += this.trimStart;
        clip.trimEnd += this.trimEnd;
        clip.duration = Math.max(0.1, clip.duration - this.trimStart - this.trimEnd);

        track.clips.sort((a, b) => a.start - b.start);
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
        const clip = track.clips.find(c => c.id === this.clipId);
        if (!clip) continue;

        // Restore original trim values
        clip.trimStart = this.beforeSnapshot.trimStart;
        clip.trimEnd = this.beforeSnapshot.trimEnd;
        clip.duration = this.beforeSnapshot.duration;

        track.clips.sort((a, b) => a.start - b.start);
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
      trimStart: this.trimStart,
      trimEnd: this.trimEnd,
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
