import { Clip, Sequence, Track } from "../types";

const moduleUrl = "/wasm/timeline-engine.js";

type TimelineModule = {
  Timeline: new () => any;
  EffectsProcessor: new () => any;
  Compositor: new () => any;
};

export class TimelineService {
  private modulePromise?: Promise<TimelineModule>;
  private timeline?: any;
  private compositor?: any;
  private effects?: any;
  private disabled = false;
  private disableReason: Error | null = null;

  private async loadModule(): Promise<TimelineModule> {
    if (this.modulePromise) return this.modulePromise;
    if (typeof window === "undefined") {
      throw new Error("TimelineService can only be used in the browser");
    }
    this.modulePromise = import(/* webpackIgnore: true */ moduleUrl).then(
      async (mod: any) => {
        const factory = mod.createTimelineModule || mod.default;
        if (!factory) {
          throw new Error("timeline-engine module missing factory");
        }
        return factory();
      },
    );
    return this.modulePromise;
  }

  private markUnavailable(error: unknown) {
    if (this.disabled) {
      return;
    }
    this.disabled = true;
    this.disableReason = error instanceof Error ? error : new Error(String(error));
    console.warn("TimelineService disabled; falling back to no-op timeline.", this.disableReason);
  }

  private unavailableError() {
    return (
      this.disableReason ??
      new Error("TimelineService is unavailable in this environment")
    );
  }

  async ready() {
    if (this.disabled) {
      return null;
    }
    if (this.timeline) return this.timeline;
    try {
      const mod = await this.loadModule();
      this.timeline = new mod.Timeline();
      this.compositor = new mod.Compositor();
      this.effects = new mod.EffectsProcessor();
      return this.timeline;
    } catch (error) {
      this.markUnavailable(error);
      return null;
    }
  }

  async setSequence(sequence: Sequence) {
    const timeline = await this.ready();
    if (!timeline) return;
    try {
      timeline.setSequenceMetadata(sequence.width, sequence.height, sequence.fps, sequence.sampleRate);
      sequence.tracks.forEach((track) => timeline.addTrack(track));
    } catch (error) {
      this.markUnavailable(error);
    }
  }

  async upsertTrack(track: Track) {
    const timeline = await this.ready();
    if (!timeline) return;
    try {
      if (!timeline.updateTrack(track)) {
        timeline.addTrack(track);
      }
    } catch (error) {
      this.markUnavailable(error);
    }
  }

  async removeTrack(trackId: string) {
    const timeline = await this.ready();
    if (!timeline) return;
    try {
      timeline.removeTrack(trackId);
    } catch (error) {
      this.markUnavailable(error);
    }
  }

  async upsertClip(clip: Clip) {
    const timeline = await this.ready();
    if (!timeline) return;
    try {
      timeline.upsertClip(clip);
    } catch (error) {
      this.markUnavailable(error);
    }
  }

  async moveClip(clipId: string, trackId: string, start: number) {
    const timeline = await this.ready();
    if (!timeline) return;
    try {
      timeline.moveClip(clipId, trackId, start);
    } catch (error) {
      this.markUnavailable(error);
    }
  }

  async trimClip(clipId: string, trimStart: number, trimEnd: number) {
    const timeline = await this.ready();
    if (!timeline) return;
    try {
      timeline.trimClip(clipId, trimStart, trimEnd);
    } catch (error) {
      this.markUnavailable(error);
    }
  }

  async splitClip(clipId: string, offset: number) {
    const timeline = await this.ready();
    if (!timeline) return;
    try {
      timeline.splitClip(clipId, offset);
    } catch (error) {
      this.markUnavailable(error);
    }
  }

  async rippleDelete(clipId: string) {
    const timeline = await this.ready();
    if (!timeline) return;
    try {
      timeline.rippleDelete(clipId);
    } catch (error) {
      this.markUnavailable(error);
    }
  }

  async serialize(): Promise<Sequence> {
    const timeline = await this.ready();
    if (!timeline) {
      throw this.unavailableError();
    }
    const serialized = timeline.serialize();
    const parsed = JSON.parse(serialized);
    return parsed.sequence as Sequence;
  }

  async frameAt(time: number) {
    const timeline = await this.ready();
    if (!timeline) {
      throw this.unavailableError();
    }
    return timeline.frameAt(time);
  }

  async compose(sequence: Sequence, time: number) {
    if (!this.compositor) {
      await this.ready();
    }
    if (!this.compositor) {
      throw this.unavailableError();
    }
    try {
      return this.compositor.compose(sequence, time);
    } catch (error) {
      this.markUnavailable(error);
      throw this.unavailableError();
    }
  }

  async evaluateEffects(clip: Clip, localTime: number) {
    if (!this.effects) {
      await this.ready();
    }
    if (!this.effects) {
      throw this.unavailableError();
    }
    try {
      return this.effects.evaluate(clip, localTime);
    } catch (error) {
      this.markUnavailable(error);
      throw this.unavailableError();
    }
  }
}

export const timelineService = new TimelineService();
