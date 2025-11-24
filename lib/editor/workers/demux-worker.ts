/// <reference lib="webworker" />

import {
  Input,
  BlobSource,
  UrlSource,
  ALL_FORMATS,
  AudioBufferSink,
  CanvasSink,
} from "mediabunny";
import type {
  DemuxRequestMessage,
  DemuxResponseMessage,
  DemuxWorkerMessage,
  ThumbnailRequestMessage,
  ThumbnailResponseMessage,
} from "./messages";
import type { MediaAssetMeta } from "../types";

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
const canBuildWaveform =
  typeof (globalThis as unknown as { AudioBuffer?: unknown }).AudioBuffer ===
  "function";

ctx.onmessage = async (event: MessageEvent<DemuxWorkerMessage>) => {
  const message = event.data;

  if (message.type === "THUMBNAIL_REQUEST") {
    await handleThumbnailRequest(message);
    return;
  }

  if (message.type !== "DEMUX_REQUEST") {
    return;
  }

  const { file, requestId, assetId } = message;

  try {
    const input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS,
    });
    const duration = await input.computeDuration();
    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    const packetStats = videoTrack
      ? await videoTrack.computePacketStats(240)
      : null;
    const waveform = audioTrack
      ? await safeBuildWaveform(audioTrack, duration)
      : undefined;

    const asset: MediaAssetMeta = {
      id: assetId,
      name: file.name,
      type: videoTrack ? "video" : "audio",
      duration,
      width: videoTrack?.displayWidth ?? 0,
      height: videoTrack?.displayHeight ?? 0,
      fps: packetStats?.averagePacketRate ?? 30,
      sampleRate: audioTrack?.sampleRate,
      url: "",
    } as MediaAssetMeta;

    const payload: DemuxResponseMessage = {
      type: "DEMUX_RESULT",
      requestId,
      assetId,
      asset,
      waveform,
    };

    const transfers: Transferable[] = [];
    if (waveform) {
      transfers.push(waveform.buffer);
    }
    ctx.postMessage(payload, transfers);
    input.dispose();
  } catch (error) {
    ctx.postMessage({
      type: "DEMUX_ERROR",
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

async function safeBuildWaveform(
  audioTrack: any,
  duration: number,
): Promise<Float32Array | undefined> {
  if (!canBuildWaveform) {
    return undefined;
  }
  try {
    return await buildWaveform(audioTrack, duration);
  } catch (error) {
    return undefined;
  }
}

async function buildWaveform(
  audioTrack: any,
  duration: number,
): Promise<Float32Array> {
  const sink = new AudioBufferSink(audioTrack);
  const bucketCount = Math.min(512, Math.max(64, Math.ceil(duration * 10)));
  const buckets = new Float32Array(bucketCount);
  let processed = 0;
  for await (const entry of sink.buffers()) {
    const channel = entry.buffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < channel.length; i += 64) {
      sum += Math.abs(channel[i]);
    }
    const amplitude = sum / Math.max(1, Math.floor(channel.length / 64));
    const index = Math.min(
      bucketCount - 1,
      Math.floor(((entry.timestamp + processed) / duration) * bucketCount),
    );
    buckets[index] = Math.max(buckets[index], amplitude);
    processed += entry.duration;
  }
  return buckets;
}

async function handleThumbnailRequest(
  message: ThumbnailRequestMessage,
): Promise<void> {
  const { requestId, assetId, mediaUrl, duration, count } = message;

  try {
    // Validate mediaUrl
    if (!mediaUrl || typeof mediaUrl !== "string") {
      throw new Error("Invalid media URL provided");
    }

    // Check if it's a blob URL that might be revoked
    if (mediaUrl.startsWith("blob:")) {
      // Try to verify the blob is still valid by attempting a HEAD request
      try {
        const response = await fetch(mediaUrl, { method: "HEAD" });
        if (!response.ok) {
          throw new Error("Blob URL is no longer valid or accessible");
        }
      } catch (e) {
        throw new Error("Blob URL appears to be revoked or inaccessible");
      }
    }

    // Fetch the video file
    const response = await fetch(mediaUrl);
    const blob = await response.blob();

    let input;
    try {
      input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    } catch (e) {
      throw new Error(
        `Failed to create Input from URL: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    let videoTrack;
    try {
      videoTrack = await input.getPrimaryVideoTrack();
    } catch (e) {
      input.dispose();
      throw new Error(
        `Failed to get video track: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    if (!videoTrack) {
      throw new Error("No video track found in media file");
    }

    const canDecode = await videoTrack.canDecode();

    if (!canDecode) {
      const codec = videoTrack.codec || "unknown";
      throw new Error(`Video codec '${codec}' cannot be decoded by browser`);
    }

    // Create CanvasSink with thumbnail dimensions (160x90 for timeline)
    const sink = new CanvasSink(videoTrack, {
      width: 160,
      height: 90,
      fit: "cover", // Required when both width and height are specified
      poolSize: 3,
    });

    // Generate equally-spaced timestamps
    const startTimestamp = await videoTrack.getFirstTimestamp();
    const endTimestamp = await videoTrack.computeDuration();

    const timestamps: number[] = [];

    if (count === 1) {
      // Special case: only first frame
      timestamps.push(startTimestamp);
    } else {
      // Multiple frames: equally spaced
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1); // 0 to 1
        timestamps.push(startTimestamp + t * (endTimestamp - startTimestamp));
      }
    }

    // Extract thumbnails and upload to R2 in parallel
    // Phase 1: Generate all thumbnail blobs first
    const blobs: Blob[] = [];
    let blobIndex = 0;

    for await (const result of sink.canvasesAtTimestamps(timestamps)) {
      if (!result) {
        continue;
      }

      const canvas = result.canvas as OffscreenCanvas;
      const blob = await canvas.convertToBlob({
        type: "image/jpeg",
        quality: 0.7, // Restored quality since we're not storing in project state
      });

      blobs.push(blob);
      blobIndex++;

      // Send generation progress update
      ctx.postMessage({
        type: "THUMBNAIL_PROGRESS",
        requestId,
        progress: (blobIndex / count) * 0.5, // 0-50% for generation
        current: blobIndex,
        total: count,
        phase: "generation",
      });
    }

    // Phase 2: Upload all blobs in parallel with progressive updates
    const results: Array<{ success: boolean; url: string; index: number }> = [];
    let completedUploads = 0;

    const uploadPromises = blobs.map((blob, index) =>
      uploadThumbnailToR2(blob, assetId, index)
        .then((url) => {
          const result = { success: true as const, url, index };
          results.push(result);
          completedUploads++;

          // Send progressive update with partial results
          const sortedResults = [...results].sort((a, b) => a.index - b.index);
          const partialThumbnails = sortedResults.map((r) => r.url);

          ctx.postMessage({
            type: "THUMBNAIL_PROGRESS",
            requestId,
            progress: 0.5 + (completedUploads / count) * 0.5, // 50-100%
            current: completedUploads,
            total: count,
            phase: "upload",
            thumbnails: partialThumbnails, // Include partial results for progressive rendering
            indices: sortedResults.map((r) => r.index),
          });

          return result;
        })
        .catch(async (error) => {
          console.warn(
            `Failed to upload thumbnail ${index} for asset ${assetId}:`,
            error.message || error,
          );
          // Fallback to data URL if R2 upload fails
          const dataUrl = await blobToDataUrl(blob);
          const result = { success: false as const, url: dataUrl, index };
          results.push(result);
          completedUploads++;

          // Send progressive update even for fallback
          const sortedResults = [...results].sort((a, b) => a.index - b.index);
          const partialThumbnails = sortedResults.map((r) => r.url);

          ctx.postMessage({
            type: "THUMBNAIL_PROGRESS",
            requestId,
            progress: 0.5 + (completedUploads / count) * 0.5,
            current: completedUploads,
            total: count,
            phase: "upload",
            thumbnails: partialThumbnails,
            indices: sortedResults.map((r) => r.index),
          });

          return result;
        }),
    );

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);

    // Sort by index to maintain correct order
    results.sort((a, b) => a.index - b.index);
    const thumbnails = results.map((r) => r.url);

    // Send result
    const payload: ThumbnailResponseMessage = {
      type: "THUMBNAIL_RESULT",
      requestId,
      assetId,
      thumbnails,
    };

    ctx.postMessage(payload);
    input.dispose();
  } catch (error) {
    // Provide more helpful error messages
    let errorMessage = error instanceof Error ? error.message : String(error);

    // Check for common MediaBunny errors and provide better context
    if (
      errorMessage.includes("unsupported") ||
      errorMessage.includes("unrecognizable")
    ) {
      errorMessage = `Media format not supported: ${errorMessage}. The file may be corrupted or the blob URL may have been revoked.`;
    }

    ctx.postMessage({
      type: "THUMBNAIL_ERROR",
      requestId,
      error: errorMessage,
    });
  }
}

async function uploadThumbnailToR2(
  blob: Blob,
  assetId: string,
  index: number,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob);
  formData.append("assetId", assetId);
  formData.append("index", index.toString());

  // Workers need absolute URLs - construct from current origin
  const apiUrl = `${self.location.origin}/api/upload-thumbnail`;

  const response = await fetch(apiUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${error}`);
  }

  const result = await response.json();
  return result.url;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
