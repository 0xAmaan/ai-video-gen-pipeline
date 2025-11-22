import {
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Texture,
  type ColorSpace,
} from "three";
import { WebGPURenderer } from "three/webgpu";
import type { Clip, MediaAssetMeta, Sequence } from "../types";
import { VideoLoader } from "./video-loader";

type GetSequence = () => Sequence | null;
type GetAsset = (id: string) => MediaAssetMeta | undefined;
type TimeUpdateHandler = (time: number) => void;

const DISPLAY_P3: ColorSpace | "display-p3" = "display-p3";

/**
 * WebGPU preview renderer for the editor. Uses two stacked planes with basic
 * materials so it stays compatible with WebGPURenderer (which rejects raw
 * ShaderMaterials). Plane B fades in for simple crossfades between clips.
 */
export class WebGpuPreviewRenderer {
  private renderer?: WebGPURenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  private geometry = new PlaneGeometry(2, 2);
  private meshA?: Mesh;
  private meshB?: Mesh;
  private textureA = new Texture();
  private textureB = new Texture();
  private bitmapA?: ImageBitmap;
  private bitmapB?: ImageBitmap;
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
    this.bitmapA?.close();
    this.bitmapB?.close();
    this.textureA.dispose();
    this.textureB.dispose();
    this.geometry.dispose();
    const materialA = this.meshA?.material;
    if (materialA && !Array.isArray(materialA)) {
      materialA.dispose();
    }
    const materialB = this.meshB?.material;
    if (materialB && !Array.isArray(materialB)) {
      materialB.dispose();
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
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = DISPLAY_P3;
    this.textureA.colorSpace = DISPLAY_P3;
    this.textureB.colorSpace = DISPLAY_P3;

    const materialA = new MeshBasicMaterial({
      map: this.textureA,
      transparent: false,
      depthTest: false,
      depthWrite: false,
    });

    const materialB = new MeshBasicMaterial({
      map: this.textureB,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });

    this.meshA = new Mesh(this.geometry, materialA);
    this.meshB = new Mesh(this.geometry, materialB);
    this.meshB.visible = false;

    this.scene.add(this.meshA);
    this.scene.add(this.meshB);
    await this.renderer.init();
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
      if (this.bitmapA) {
        this.bitmapA.close();
      }
      this.currentFrame = frame;
      this.bitmapA = await createImageBitmap(frame);
      this.textureA.image = this.bitmapA;
      this.textureA.needsUpdate = true;
      // Frame no longer needed after bitmap upload.
      this.currentFrame.close();
      this.currentFrame = undefined;

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
            if (this.bitmapB) this.bitmapB.close();
            this.nextFrame = nextFrame;
            this.bitmapB = await createImageBitmap(nextFrame);
            this.textureB.image = this.bitmapB;
            this.textureB.needsUpdate = true;
            this.nextFrame.close();
            this.nextFrame = undefined;
            const delta = Math.max(0, this.transitionWindow - (nextClip.start - this.currentTime));
            mixValue = Math.min(1, delta / this.transitionWindow);
          }
        }
      } else if (this.nextFrame) {
        this.nextFrame.close();
        this.nextFrame = undefined;
        if (this.bitmapB) {
          this.bitmapB.close();
          this.bitmapB = undefined;
        }
      }

      if (this.meshB?.material instanceof MeshBasicMaterial) {
        this.meshB.material.opacity = mixValue;
        this.meshB.visible = mixValue > 0;
        this.meshB.material.needsUpdate = true;
      }

      await this.renderer.renderAsync(this.scene, this.camera);
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
