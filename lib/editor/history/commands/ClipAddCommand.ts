import { BaseCommand } from "../command";
import type { Project, Clip } from "../../types";

/**
 * Command for adding a new clip to the timeline
 */
export class ClipAddCommand extends BaseCommand {
  private addedClipId: string | null = null;

  constructor(
    private getProject: () => Project | null,
    private setProject: (project: Project) => void,
    private clip: Clip,
    private trackId: string,
  ) {
    super("clip:add", `Add clip to track ${trackId}`);
    this.addedClipId = clip.id;
  }

  execute(): boolean {
    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);

    for (const sequence of clone.sequences) {
      const track = sequence.tracks.find(t => t.id === this.trackId);
      if (!track) continue;

      // Add the clip
      track.clips.push(structuredClone(this.clip));
      track.clips.sort((a, b) => a.start - b.start);
      recalculateSequenceDuration(sequence);

      this.setProject(clone);
      return true;
    }

    return false;
  }

  undo(): boolean {
    if (!this.addedClipId) return false;

    const project = this.getProject();
    if (!project) return false;

    const clone = structuredClone(project);

    for (const sequence of clone.sequences) {
      for (const track of sequence.tracks) {
        const index = track.clips.findIndex(c => c.id === this.addedClipId);
        if (index !== -1) {
          track.clips.splice(index, 1);
          track.clips.sort((a, b) => a.start - b.start);
          recalculateSequenceDuration(sequence);

          this.setProject(clone);
          return true;
        }
      }
    }

    return false;
  }

  protected serializeData(): Record<string, unknown> {
    return {
      clip: this.clip,
      trackId: this.trackId,
      addedClipId: this.addedClipId,
    };
  }
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
