import type { Sequence, MediaAssetMeta } from "../types";
import { FrameRenderer } from "./frame-renderer";
import { OptimizedFrameRenderer, OptimizedFrameRendererOptions } from "./optimized-frame-renderer";
import { PerformanceMonitor, type PerformanceMetrics } from "./performance-monitor";
import {
  Output,
  CanvasSource,
  Mp4OutputFormat,
  BufferTarget,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_LOW,
} from "mediabunny";

export type ExportOptions = {
  resolution: string;
  quality: string;
  format: string;
  // Performance options
  enableOptimizations?: boolean;
  enablePerformanceMonitoring?: boolean;
  parallelProcessing?: boolean;
  frameBufferSize?: number;
};

export type ExportProgressHandler = (progress: number, status: string) => void;

export interface ExportResult {
  blob: Blob;
  metrics?: PerformanceMetrics;
}

export class ExportPipeline {
  private abortController: AbortController | null = null;
  private performanceMonitor: PerformanceMonitor | null = null;

  async exportSequence(
    sequence: Sequence,
    assets: Record<string, MediaAssetMeta>,
    options: ExportOptions,
    onProgress?: ExportProgressHandler,
  ): Promise<Blob> {
    this.abortController = new AbortController();

    // Initialize performance monitoring if enabled
    if (options.enablePerformanceMonitoring !== false) {
      this.performanceMonitor = new PerformanceMonitor();
      this.performanceMonitor.start();
    }

    try {
      // Parse resolution (e.g., "1920x1080")
      const [widthStr, heightStr] = options.resolution.split("x");
      const width = parseInt(widthStr) || 1280;
      const height = parseInt(heightStr) || 720;
      const fps = 30;
      const totalFrames = Math.ceil(sequence.duration * fps);

      // Log video metrics for performance tracking
      this.performanceMonitor?.setVideoMetrics(width, height, totalFrames, this.getBitrateFromQuality(options.quality));

      onProgress?.(0, "Initializing encoder...");

      // Choose renderer based on optimization settings
      const useOptimized = options.enableOptimizations !== false;
      let frameRenderer: FrameRenderer | OptimizedFrameRenderer;
      
      if (useOptimized) {
        const rendererOptions: Partial<OptimizedFrameRendererOptions> = {
          enableParallelSeeking: options.parallelProcessing !== false,
          frameBufferSize: options.frameBufferSize || 32,
          batchSize: this.calculateOptimalBatchSize(width, height),
          enableGarbageCollection: true,
        };
        
        frameRenderer = new OptimizedFrameRenderer(width, height, rendererOptions);
        
        // Connect performance monitoring
        if (this.performanceMonitor) {
          (frameRenderer as OptimizedFrameRenderer).setFrameMetricsCallback(
            (metrics) => this.performanceMonitor?.recordFrameMetrics(
              metrics.frameNumber || 0, 
              metrics.timestamp || 0, 
              metrics
            )
          );
        }
        
        console.log(`[Export Pipeline] Using optimized renderer with ${rendererOptions.batchSize} batch size`);
      } else {
        frameRenderer = new FrameRenderer(width, height);
        console.log(`[Export Pipeline] Using standard renderer`);
      }

      const canvas = frameRenderer.getCanvas();

      // Create MediaBunny output with quality-optimized settings
      this.performanceMonitor?.startTimer('encoding');
      
      const output = new Output({
        format: new Mp4OutputFormat(),
        target: new BufferTarget(),
      });

      // Create canvas source with optimized settings
      const canvasSource = new CanvasSource(canvas, {
        codec: "avc",
        bitrate: this.getBitrateFromQuality(options.quality),
      });

      // Add video track and start output
      output.addVideoTrack(canvasSource, { frameRate: fps });
      await output.start();

      onProgress?.(5, "Rendering and encoding...");
      this.performanceMonitor?.startTimer('rendering');

      let frameCount = 0;
      const frameDuration = 1 / fps;

      await frameRenderer.renderSequence(
        sequence,
        assets,
        fps,
        async (frameData, timestamp) => {
          if (this.abortController?.signal.aborted) {
            throw new Error("Export cancelled");
          }

          // Add the canvas frame (timestamp and duration in seconds)
          await canvasSource.add(timestamp, frameDuration);
          frameCount++;

          const progress = 5 + (frameCount / totalFrames) * 90;
          onProgress?.(
            progress,
            `Encoding frame ${frameCount}/${totalFrames}...`,
          );
          
          // Log slow frame warning
          if (frameCount % 30 === 0) { // Log every second of video
            console.log(`[Export Pipeline] Processed ${frameCount}/${totalFrames} frames (${(frameCount/totalFrames*100).toFixed(1)}%)`);
          }
        },
        (progress) => {
          // Frame render progress (not used since we report in the frame callback)
        },
      );

      this.performanceMonitor?.endTimer('rendering');

      // Finalize encoding
      canvasSource.close();
      await output.finalize();
      
      this.performanceMonitor?.endTimer('encoding');

      onProgress?.(95, "Finalizing...");

      // Get the encoded buffer
      const buffer = (output.target as BufferTarget).buffer;
      if (!buffer) {
        throw new Error("Export failed: No buffer generated");
      }
      const blob = new Blob([buffer], { type: `video/${options.format}` });
      
      // Log file size for performance tracking
      this.performanceMonitor?.setFileSize(blob.size);

      onProgress?.(100, "Complete!");

      return blob;
    } catch (error) {
      // Log export error
      if (this.performanceMonitor) {
        const errorType = error instanceof Error && error.message === "Export cancelled" 
          ? "unknown" as const 
          : "encoding_failure" as const;
        this.performanceMonitor.logError(errorType, error instanceof Error ? error.message : String(error));
      }
      
      if (error instanceof Error && error.message === "Export cancelled") {
        throw error;
      }
      throw new Error(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      // Finish performance monitoring
      if (this.performanceMonitor) {
        try {
          const metrics = this.performanceMonitor.finish();
          console.log(`[Export Pipeline] Export completed in ${metrics.totalExportTime?.toFixed(2)}ms`);
        } catch (monitorError) {
          console.warn('[Export Pipeline] Performance monitoring error:', monitorError);
        }
        this.performanceMonitor = null;
      }
      
      this.abortController = null;
    }
  }
  
  private getBitrateFromQuality(quality: string): number {
    switch (quality.toLowerCase()) {
      case 'low':
        return QUALITY_LOW;
      case 'medium':
        return QUALITY_MEDIUM;
      case 'high':
      default:
        return QUALITY_HIGH;
    }
  }
  
  private calculateOptimalBatchSize(width: number, height: number): number {
    // Calculate batch size based on resolution to manage memory usage
    const pixels = width * height;
    
    if (pixels >= 3840 * 2160) { // 4K
      return 4; // Smaller batches for 4K
    } else if (pixels >= 1920 * 1080) { // 1080p
      return 6;
    } else if (pixels >= 1280 * 720) { // 720p
      return 8;
    } else { // Lower resolutions
      return 12;
    }
  }

  cancel() {
    this.abortController?.abort();
  }
}

let pipelineSingleton: ExportPipeline | null = null;
const canUseWorkers =
  typeof window !== "undefined" && typeof window.Worker !== "undefined";

export const getExportPipeline = (): ExportPipeline => {
  if (!canUseWorkers) {
    throw new Error("Export pipeline is only available in the browser");
  }
  if (!pipelineSingleton) {
    pipelineSingleton = new ExportPipeline();
  }
  return pipelineSingleton;
};
