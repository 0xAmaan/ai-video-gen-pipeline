import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  VideoTexture,
  type ColorSpace,
} from "three";
import { WebGPURenderer } from "three/webgpu";
import type { Clip, MediaAssetMeta, Sequence } from "../types";
import { VideoLoader } from "./video-loader";
import { ShaderManager } from "./shader-manager";

type GetSequence = () => Sequence | null;
type GetAsset = (id: string) => MediaAssetMeta | undefined;
type TimeUpdateHandler = (time: number) => void;

const DISPLAY_P3: ColorSpace | "display-p3" = "display-p3";

export class WebGpuPreviewRenderer {
  private renderer?: WebGPURenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  private mesh?: Mesh;
  private textureA = new VideoTexture(document.createElement("video"));
  private textureB = new VideoTexture(document.createElement("video"));
  private shader = new ShaderManager();
  private loaders = new Map<string, VideoLoader>();
  private currentFrame?: VideoFrame;
  private nextFrame?: VideoFrame;
  private currentClip?: Clip;
  private playing = false;
  private raf?: number;
  private currentTime = 0;
  private renderInFlight = false;
  private onTimeUpdate?: TimeUpdateHandler;
  private audioContext?: AudioContext;
  private clockOffset = 0;
  private readonly transitionWindow = 0.35;

  constructor(
    private readonly getSequence: GetSequence,
    private readonly getAsset: GetAsset,
  ) {
    this.camera.position.z = 1;
    this.textureA.matrixAutoUpdate = true;
    this.textureB.matrixAutoUpdate = true;
  }

  async attach(canvas: HTMLCanvasElement) {
    if (!navigator?.gpu) {
      throw new Error("WebGPU is not available in this browser");
    }
    if (!this.renderer) {
      await this.createRenderer(canvas);
    }
    await this.renderFrame();
  }

  setTimeUpdateHandler(handler: TimeUpdateHandler) {
    this.onTimeUpdate = handler;
  }

  async play() {
    this.playing = true;
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    await this.audioContext.resume().catch(() => undefined);
    this.clockOffset = (this.audioContext?.currentTime ?? 0) - this.currentTime;
    await this.renderFrame();
    this.raf = requestAnimationFrame(this.tick);
  }

  pause() {
    this.playing = false;
    void this.audioContext?.suspend().catch(() => undefined);
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = undefined;
    }
  }

  async seek(time: number) {
    this.currentTime = time;
    if (this.audioContext) {
      this.clockOffset = this.audioContext.currentTime - time;
    }
    await this.renderFrame();
  }

  detach() {
    this.pause();
    this.currentFrame?.close();
    this.nextFrame?.close();
    this.textureA.dispose();
    this.textureB.dispose();
    this.mesh?.geometry.dispose();
    const material = this.mesh?.material;
    if (material && !Array.isArray(material)) {
      material.dispose();
    }
    this.renderer?.dispose();
    this.loaders.forEach((loader) => loader.dispose());
    this.loaders.clear();
    this.audioContext?.close().catch(() => undefined);
  }

  private tick = async (timestamp: number) => {
    if (!this.playing) return;
    if (this.audioContext) {
      this.currentTime = Math.max(0, this.audioContext.currentTime - this.clockOffset);
    } else {
      this.currentTime = timestamp / 1000;
    }
    this.onTimeUpdate?.(this.currentTime);
    await this.renderFrame();
    this.raf = requestAnimationFrame(this.tick);
  };

  private async createRenderer(canvas: HTMLCanvasElement) {
    this.renderer = new WebGPURenderer({
      antialias: true,
      alpha: false,
      canvas,
    });
    this.renderer.outputColorSpace = DISPLAY_P3;
    this.textureA.colorSpace = DISPLAY_P3;
    this.textureB.colorSpace = DISPLAY_P3;
    this.mesh = new Mesh(new PlaneGeometry(2, 2), this.shader.material);
    this.scene.add(this.mesh);
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  }

  private async renderFrame() {
    if (!this.renderer || this.renderInFlight) return;
    this.renderInFlight = true;
    try {
      const sequence = this.getSequence();
      if (!sequence) {
        this.renderer?.clear();
        return;
      }

      const clip = this.resolveClip(sequence, this.currentTime);
      if (!clip) {
        this.currentClip = undefined;
        this.renderer?.clear();
        return;
      }

      const asset = this.getAsset(clip.mediaId);
      if (!asset) {
        return;
      }

      const loader = await this.getLoader(asset);
      if (this.currentClip?.mediaId !== clip.mediaId) {
        this.currentClip = clip;
        await loader.seek(Math.max(0, clip.trimStart));
      }

      const frameTime = this.currentTime - clip.start + clip.trimStart;
      const frame = await loader.getFrameAt(frameTime);
      if (!frame) return;

      if (this.currentFrame) {
        this.currentFrame.close();
      }
      this.currentFrame = frame;
      this.textureA.source.data = frame;
      this.textureA.needsUpdate = true;

      let mixValue = 0;
      const nextClip = this.findNextClip(sequence, this.currentTime);
      if (nextClip && nextClip.start - this.currentTime <= this.transitionWindow) {
        const nextAsset = this.getAsset(nextClip.mediaId);
        const nextLoader = nextAsset ? await this.getLoader(nextAsset) : null;
        if (nextLoader) {
          const offset = Math.max(0, this.currentTime - nextClip.start);
          const nextFrame = await nextLoader.getFrameAt(nextClip.trimStart + offset);
          if (nextFrame) {
            if (this.nextFrame) this.nextFrame.close();
            this.nextFrame = nextFrame;
            this.textureB.source.data = nextFrame;
            this.textureB.needsUpdate = true;
            const delta = Math.max(0, this.transitionWindow - (nextClip.start - this.currentTime));
            mixValue = Math.min(1, delta / this.transitionWindow);
          }
        }
      } else if (this.nextFrame) {
        this.nextFrame.close();
        this.nextFrame = undefined;
      }

      this.shader.updateTextures(this.textureA, mixValue > 0 ? this.textureB : this.textureA, mixValue);

      this.renderer.render(this.scene, this.camera);
    } finally {
      this.renderInFlight = false;
    }
  }

  private resolveClip(sequence: Sequence, time: number) {
    for (const track of sequence.tracks) {
      for (const clip of track.clips) {
        if (time >= clip.start && time <= clip.start + clip.duration) {
          return clip;
        }
      }
    }
    return undefined;
  }

  private findNextClip(sequence: Sequence, time: number) {
    let candidate: Clip | undefined;
    for (const track of sequence.tracks) {
      for (const clip of track.clips) {
        if (clip.start > time && (!candidate || clip.start < candidate.start)) {
          candidate = clip;
        }
      }
    }
    return candidate;
  }

  private async getLoader(asset: MediaAssetMeta) {
    const existing = this.loaders.get(asset.id);
    if (existing) return existing;
    const loader = new VideoLoader(asset, { lookaheadSeconds: 1 });
    this.loaders.set(asset.id, loader);
    await loader.init();
    return loader;
  }
}
