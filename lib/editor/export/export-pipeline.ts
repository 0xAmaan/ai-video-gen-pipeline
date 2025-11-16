import type { Sequence, MediaAssetMeta } from "../types";
import { FrameRenderer } from "./frame-renderer";
import {
  Output,
  CanvasSource,
  Mp4OutputFormat,
  BufferTarget,
  QUALITY_HIGH,
} from "mediabunny";

export type ExportOptions = {
  resolution: string;
  quality: string;
  format: string;
};

export type ExportProgressHandler = (progress: number, status: string) => void;

export class ExportPipeline {
  private abortController: AbortController | null = null;

  async exportSequence(
    sequence: Sequence,
    assets: Record<string, MediaAssetMeta>,
    options: ExportOptions,
    onProgress?: ExportProgressHandler,
  ): Promise<Blob> {
    this.abortController = new AbortController();

    try {
      // Parse resolution (e.g., "1920x1080")
      const [widthStr, heightStr] = options.resolution.split("x");
      const width = parseInt(widthStr) || 1280;
      const height = parseInt(heightStr) || 720;
      const fps = 30;

      onProgress?.(0, "Initializing encoder...");

      // Create frame renderer
      const frameRenderer = new FrameRenderer(width, height);
      const canvas = frameRenderer.getCanvas();

      // Create MediaBunny output
      const output = new Output({
        format: new Mp4OutputFormat(),
        target: new BufferTarget(),
      });

      // Create canvas source for video encoding
      const canvasSource = new CanvasSource(canvas, {
        codec: "avc",
        bitrate: QUALITY_HIGH,
      });

      // Add video track and start output
      output.addVideoTrack(canvasSource, { frameRate: fps });
      await output.start();

      onProgress?.(5, "Rendering and encoding...");

      let frameCount = 0;
      const totalFrames = Math.ceil(sequence.duration * fps);
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
        },
        (progress) => {
          // Frame render progress (not used since we report in the frame callback)
        },
      );

      // Finalize encoding
      canvasSource.close();
      await output.finalize();

      onProgress?.(95, "Finalizing...");

      // Get the encoded buffer
      const buffer = (output.target as BufferTarget).buffer;
      const blob = new Blob([buffer], { type: `video/${options.format}` });

      onProgress?.(100, "Complete!");

      return blob;
    } catch (error) {
      if (error instanceof Error && error.message === "Export cancelled") {
        throw error;
      }
      throw new Error(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.abortController = null;
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
