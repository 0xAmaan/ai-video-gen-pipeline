import type { Sequence, MediaAssetMeta } from "../types";
import { FrameRenderer } from "./frame-renderer";
import {
  Output,
  CanvasSource,
  AudioBufferSource,
  Mp4OutputFormat,
  BufferTarget,
  QUALITY_HIGH,
} from "mediabunny";

const NARRATION_TRACK_ID = "audio-narration";
const BGM_TRACK_ID = "audio-bgm";

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
      const sampleRate = sequence.sampleRate || 44100;

      onProgress?.(0, "Initializing encoder...");

      // Create frame renderer
      const frameRenderer = new FrameRenderer(width, height);
      const canvas = frameRenderer.getCanvas();

      onProgress?.(2, "Mixing audio tracks...");
      const audioBuffer = await this.mixAudioTracks(
        sequence,
        assets,
        sampleRate,
      );

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

      let audioSource: AudioBufferSource | null = null;
      if (audioBuffer) {
        audioSource = new AudioBufferSource({
          codec: "aac",
          bitrate: 128000,
        });
        output.addAudioTrack(audioSource);
      }

      await output.start();

      if (audioSource && audioBuffer) {
        await audioSource.add(audioBuffer);
      }

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
      audioSource?.close();
      await output.finalize();

      onProgress?.(95, "Finalizing...");

      // Get the encoded buffer
      const buffer = (output.target as BufferTarget).buffer;
      if (!buffer) {
        throw new Error("Export failed: No buffer generated");
      }
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

  private async mixAudioTracks(
    sequence: Sequence,
    assets: Record<string, MediaAssetMeta>,
    sampleRate: number,
  ): Promise<AudioBuffer | null> {
    if (typeof OfflineAudioContext === "undefined") {
      return null;
    }

    const audioTracks = sequence.tracks.filter((track) => track.kind === "audio");
    if (audioTracks.length === 0) {
      return null;
    }

    const contextLength = Math.max(1, Math.ceil(sequence.duration * sampleRate));
    const offlineContext = new OfflineAudioContext(
      2,
      contextLength,
      sampleRate,
    );

    const narrationTrack = audioTracks.find(
      (track) => track.id === NARRATION_TRACK_ID,
    );
    const narrationRegions =
      narrationTrack?.clips.map((clip) => ({
        start: clip.start,
        end: clip.start + clip.duration,
      })) ?? [];

    const overlapsNarration = (start: number, end: number) =>
      narrationRegions.some(
        (region) => start < region.end && end > region.start,
      );

    for (const track of audioTracks) {
      for (const clip of track.clips) {
        const asset = assets[clip.mediaId];
        if (!asset || asset.type !== "audio" || !asset.url) continue;

        try {
          const response = await fetch(asset.url, {
            mode: "cors",
            credentials: "omit",
          });
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await offlineContext.decodeAudioData(arrayBuffer);

          const source = offlineContext.createBufferSource();
          source.buffer = audioBuffer;

          const gainNode = offlineContext.createGain();
          const clipVolume = clip.volume ?? 1;
          const trackVolume = track.volume ?? 1;
          const baseVolume = track.muted ? 0 : clipVolume * trackVolume;
          const clipStart = clip.start;
          const trimStart = clip.trimStart ?? 0;
          const trimEnd = clip.trimEnd ?? 0;
          const clipDuration = Math.max(
            0,
            Math.min(clip.duration, audioBuffer.duration - trimStart),
          );
          const playbackDuration = Math.max(0, clipDuration - trimEnd);
          if (playbackDuration <= 0) continue;

          const clipEnd = clipStart + playbackDuration;
          const isBgmTrack =
            track.id === BGM_TRACK_ID || /bgm/i.test(track.id ?? "");
          const shouldDuck = isBgmTrack && overlapsNarration(clipStart, clipEnd);
          const finalVolume = shouldDuck ? baseVolume * 0.5 : baseVolume;
          gainNode.gain.value = finalVolume;
          source.connect(gainNode).connect(offlineContext.destination);

          source.start(
            clip.start,
            trimStart,
            Math.min(playbackDuration, audioBuffer.duration - trimStart),
          );
        } catch (error) {
          console.error(`Failed to load audio for export: ${clip.mediaId}`, error);
        }
      }
    }

    return await offlineContext.startRendering();
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
