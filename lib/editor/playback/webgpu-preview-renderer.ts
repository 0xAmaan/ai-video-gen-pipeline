import {
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Texture,
  VideoTexture,
  type ColorSpace,
} from "three";
import { WebGPURenderer } from "three/webgpu";
import type { Clip, MediaAssetMeta, Sequence } from "../types";
import { VideoLoader } from "./video-loader";

type GetSequence = () => Sequence | null;
type GetAsset = (id: string) => MediaAssetMeta | undefined;
type TimeUpdateHandler = (time: number) => void;

// Use SRGBColorSpace constant instead of string for WebGPU compatibility
const VIDEO_COLOR_SPACE = SRGBColorSpace;

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
  private textureA?: VideoTexture;
  private textureB?: VideoTexture;
  private bitmapA?: ImageBitmap; // Deprecated: kept for fallback
  private bitmapB?: ImageBitmap; // Deprecated: kept for fallback
  private useZeroCopy = true; // Enable zero-copy VideoFrame → GPU (PRD Section 6)
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
  // Performance monitoring
  private frameRenderTimes: number[] = [];
  private slowFrameCount = 0;

  constructor(
    private readonly getSequence: GetSequence,
    private readonly getAsset: GetAsset,
  ) {
    this.camera.position.z = 1;
    // VideoTextures will be initialized when first VideoFrame is available
  }

  async attach(canvas: HTMLCanvasElement) {
    if (!navigator?.gpu) {
      this.logWebGPUError("not_available", "navigator.gpu is undefined");
      throw new Error("WebGPU is not available in this browser");
    }

    // Test adapter availability (catches M3 Pro and other hardware bugs)
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        this.logWebGPUError("adapter_unavailable", {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          cores: navigator.hardwareConcurrency,
        });
        throw new Error("WebGPU adapter unavailable - hardware may not support WebGPU");
      }

      // Log adapter info for debugging (optional, available in Chrome)
      try {
        const info = await (adapter as any).requestAdapterInfo?.();
        if (info) {
          console.log("[WebGPU] Adapter detected:", {
            vendor: info.vendor,
            architecture: info.architecture,
            device: info.device,
          });
        }
      } catch {
        // requestAdapterInfo may not be available, ignore
      }
    } catch (error) {
      this.logWebGPUError("adapter_request_failed", error);
      throw new Error(`WebGPU initialization failed: ${error instanceof Error ? error.message : String(error)}`);
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
    
    // Close VideoFrames (PRD 6.2: Memory Management)
    this.currentFrame?.close();
    this.nextFrame?.close();
    
    // Close ImageBitmaps (legacy fallback)
    this.bitmapA?.close();
    this.bitmapB?.close();
    
    // Dispose textures
    this.textureA?.dispose();
    this.textureB?.dispose();
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
    // Log preferred texture format (helps debug Metal backend issues on macOS)
    if (navigator.gpu) {
      const preferredFormat = navigator.gpu.getPreferredCanvasFormat();
      console.log("[WebGPU] Canvas format:", preferredFormat);
      // macOS Metal backend prefers 'bgra8unorm', not 'rgba8unorm'
    }

    this.renderer = new WebGPURenderer({
      antialias: true,
      alpha: false,
      canvas,
      powerPreference: "high-performance",
    });
    // Use SRGBColorSpace for WebGPU compatibility (display-p3 string not supported)
    this.renderer.outputColorSpace = SRGBColorSpace;

    // Materials will be created without textures initially
    // Textures created from VideoFrames on first render (zero-copy)
    const materialA = new MeshBasicMaterial({
      map: null, // Will be set when VideoTexture is created from VideoFrame
      transparent: false,
      depthTest: false,
      depthWrite: false,
    });

    const materialB = new MeshBasicMaterial({
      map: null, // Will be set when VideoTexture is created from VideoFrame
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

    // Performance monitoring
    const startTime = performance.now();

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

      // Close previous frame
      if (this.currentFrame) {
        this.currentFrame.close();
      }

      this.currentFrame = frame;

      // Zero-Copy Pipeline (PRD Section 6): Use VideoTexture with VideoFrame directly
      if (this.useZeroCopy) {
        // Create or update VideoTexture from VideoFrame (no ImageBitmap copy)
        if (!this.textureA) {
          this.textureA = new VideoTexture(frame as any); // TypeScript needs casting
          this.textureA.colorSpace = VIDEO_COLOR_SPACE;
          if (this.meshA?.material instanceof MeshBasicMaterial) {
            this.meshA.material.map = this.textureA;
            this.meshA.material.needsUpdate = true;
          }
        } else {
          // Update existing VideoTexture with new VideoFrame
          (this.textureA as any).source.data = frame;
          this.textureA.needsUpdate = true;
        }
      } else {
        // Legacy fallback: ImageBitmap path (requires CPU copy)
        if (this.bitmapA) {
          this.bitmapA.close();
        }
        this.bitmapA = await createImageBitmap(frame);
        if (!this.textureA) {
          this.textureA = new VideoTexture(this.bitmapA as any);
          this.textureA.colorSpace = VIDEO_COLOR_SPACE;
          if (this.meshA?.material instanceof MeshBasicMaterial) {
            this.meshA.material.map = this.textureA;
            this.meshA.material.needsUpdate = true;
          }
        } else {
          (this.textureA as any).source.data = this.bitmapA;
          this.textureA.needsUpdate = true;
        }
        // Close frame after bitmap creation
        this.currentFrame.close();
        this.currentFrame = undefined;
      }

      let mixValue = 0;
      const nextClip = this.findNextClip(sequence, this.currentTime);
      if (nextClip && nextClip.start - this.currentTime <= this.transitionWindow) {
        const nextAsset = this.getAsset(nextClip.mediaId);
        const nextLoader = nextAsset ? await this.getLoader(nextAsset) : null;
        if (nextLoader) {
          const offset = Math.max(0, this.currentTime - nextClip.start);
          const nextFrame = await nextLoader.getFrameAt(nextClip.trimStart + offset);
          if (nextFrame) {
            // Close previous transition frame
            if (this.nextFrame) this.nextFrame.close();
            
            this.nextFrame = nextFrame;

            // Zero-Copy Pipeline for transition texture
            if (this.useZeroCopy) {
              if (!this.textureB) {
                this.textureB = new VideoTexture(nextFrame as any);
                this.textureB.colorSpace = VIDEO_COLOR_SPACE;
                if (this.meshB?.material instanceof MeshBasicMaterial) {
                  this.meshB.material.map = this.textureB;
                  this.meshB.material.needsUpdate = true;
                }
              } else {
                (this.textureB as any).source.data = nextFrame;
                this.textureB.needsUpdate = true;
              }
            } else {
              // Legacy fallback: ImageBitmap path
              if (this.bitmapB) this.bitmapB.close();
              this.bitmapB = await createImageBitmap(nextFrame);
              if (!this.textureB) {
                this.textureB = new VideoTexture(this.bitmapB as any);
                this.textureB.colorSpace = VIDEO_COLOR_SPACE;
                if (this.meshB?.material instanceof MeshBasicMaterial) {
                  this.meshB.material.map = this.textureB;
                  this.meshB.material.needsUpdate = true;
                }
              } else {
                (this.textureB as any).source.data = this.bitmapB;
                this.textureB.needsUpdate = true;
              }
              this.nextFrame.close();
              this.nextFrame = undefined;
            }
            
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

      // Defensive check: ensure renderer is initialized before rendering
      if (!this.renderer) {
        console.warn('[WebGpuPreviewRenderer] renderFrame() called before renderer initialized');
        return;
      }
      
      await this.renderer.renderAsync(this.scene, this.camera);
    } finally {
      this.renderInFlight = false;

      // Track render performance
      const renderTime = performance.now() - startTime;
      this.frameRenderTimes.push(renderTime);

      // Keep only last 60 frames for averaging
      if (this.frameRenderTimes.length > 60) {
        this.frameRenderTimes.shift();
      }

      // Log slow frames (>32ms = below 30fps, target is 60fps @ 16ms)
      if (renderTime > 32) {
        this.slowFrameCount++;
        console.warn(`[WebGPU] Slow frame detected: ${renderTime.toFixed(2)}ms (target <16ms for 60fps)`);

        // Log average when multiple slow frames occur
        if (this.slowFrameCount % 10 === 0) {
          const avgTime = this.frameRenderTimes.reduce((a, b) => a + b, 0) / this.frameRenderTimes.length;
          console.warn(`[WebGPU] Performance summary: ${this.slowFrameCount} slow frames, avg: ${avgTime.toFixed(2)}ms`);
        }
      }
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

  /**
   * Log WebGPU errors with platform context for debugging.
   * In production, this could send telemetry to an analytics service.
   */
  private logWebGPUError(type: string, details: unknown) {
    const errorContext = {
      type,
      details,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      cores: navigator.hardwareConcurrency,
      timestamp: new Date().toISOString(),
    };

    console.error("[WebGPU Error]", errorContext);

    // TODO: Send to analytics/logging service in production
    // Example: analytics.trackError('webgpu_error', errorContext);
  }
}
