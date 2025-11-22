/// <reference lib="webworker" />

import {
  ALL_FORMATS,
  AudioSample,
  AudioSampleSink,
  AudioSampleSource,
  BufferTarget,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  UrlSource,
} from "mediabunny";
import { VideoLoader } from "../playback/video-loader";
import { exportUrlForAsset } from "../io/asset-url";
import type { Project, Clip } from "../types";
import type { EncodeRequestMessage, EncodeWorkerMessage } from "./messages";

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
const activeRequests = new Map<string, boolean>();
const TARGET_SAMPLE_RATE = 48_000;
const TARGET_CHANNELS = 2;

ctx.onmessage = async (event: MessageEvent<EncodeWorkerMessage>) => {
  const message = event.data;
  if (message.type === "ENCODE_CANCEL") {
    activeRequests.delete(message.requestId);
    ctx.postMessage({
      type: "ENCODE_ERROR",
      requestId: message.requestId,
      error: "cancelled",
    });
    return;
  }
  if (message.type !== "ENCODE_REQUEST") return;

  const { requestId, project, sequenceId, settings } =
    message as EncodeRequestMessage;
  activeRequests.set(requestId, true);

  try {
    const blob = await renderComposition(
      requestId,
      project,
      sequenceId,
      settings,
    );
    if (!activeRequests.get(requestId)) return;
    ctx.postMessage({ type: "ENCODE_RESULT", requestId, blob });
  } catch (error) {
    if (!activeRequests.get(requestId)) return;
    ctx.postMessage({
      type: "ENCODE_ERROR",
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    activeRequests.delete(requestId);
  }
};

async function renderComposition(
  requestId: string,
  project: Project,
  sequenceId: string,
  settings: EncodeRequestMessage["settings"],
): Promise<Blob> {
  if (typeof OffscreenCanvas === "undefined") {
    return new Blob(
      [
        JSON.stringify(
          {
            projectId: project.id,
            sequenceId,
            settings,
            note: "OffscreenCanvas unavailable",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
  }

  const [targetWidth, targetHeight] = parseResolution(settings.resolution);
  const sequence =
    project.sequences.find((seq) => seq.id === sequenceId) ??
    project.sequences[0];
  const fps = sequence?.fps ?? 30;
  const frameDuration = 1 / fps;
  const totalFrames = Math.max(1, Math.ceil((sequence?.duration ?? 0) * fps));

  console.log("[Export] Starting render:", {
    resolution: `${targetWidth}x${targetHeight}`,
    fps,
    duration: sequence?.duration,
    totalFrames,
    quality: settings.quality,
    hasAudio: hasAudio(sequence),
  });

  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const context = canvas.getContext("2d");
  if (!context) {
    return new Blob([new ArrayBuffer(0)], { type: "application/octet-stream" });
  }

  const format = new Mp4OutputFormat();
  const target = new BufferTarget();
  const output = new Output({ format, target });
  const videoTrack = new CanvasSource(canvas, {
    codec: "avc",
    bitrate: pickBitrate(targetWidth, targetHeight, settings.quality),
    keyFrameInterval: 2,
    latencyMode: "quality",
  });

  const shouldIncludeAudio = settings.includeAudio !== false && hasAudio(sequence);
  const audioSource = shouldIncludeAudio ? await createAudioSource(settings.quality) : null;
  output.addVideoTrack(videoTrack, { frameRate: fps });
  if (audioSource) {
    output.addAudioTrack(audioSource, { languageCode: "und" });
  }

  await output.start();

  const renderCtx = createRenderContext(project);
  try {
    let lastFrameHadContent = false;
    let blackFrameCount = 0;
    
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      if (!activeRequests.get(requestId)) {
        throw new Error("cancelled");
      }
      const timelineTime = frameIndex * frameDuration;
      
      // Track whether this frame will have content
      const frameWillHaveContent = sequence?.tracks.some(track =>
        track.clips.some(clip =>
          timelineTime >= clip.start && timelineTime < clip.start + clip.duration
        )
      ) ?? false;
      
      await renderFrame(
        context,
        targetWidth,
        targetHeight,
        timelineTime,
        sequence?.tracks ?? [],
        project.mediaAssets,
        renderCtx,
      );
      await videoTrack.add(timelineTime, frameDuration);
      
      // Detect black frame pattern
      if (!frameWillHaveContent) {
        blackFrameCount++;
        if (frameIndex < 10 || (frameIndex % 10 === 0 && blackFrameCount > frameIndex * 0.3)) {
          console.warn(
            '[EncodeWorker] Frame', frameIndex, 'at', timelineTime.toFixed(3),
            's has no clips (black frame) - total black frames:', blackFrameCount
          );
        }
      }
      if (frameIndex % Math.max(1, Math.floor(totalFrames / 25)) === 0) {
        reportProgress(
          requestId,
          Math.min(90, (frameIndex / totalFrames) * 80 + 5),
          `Rendering ${Math.round((timelineTime + frameDuration) * 1000) / 1000}s`,
        );
      }
    }
  } finally {
    renderCtx.dispose();
  }

  if (audioSource && sequence) {
    reportProgress(requestId, 92, "Mixing audio");
    await renderAudio(
      requestId,
      sequence.tracks,
      project.mediaAssets,
      audioSource,
      sequence.duration ?? 0,
    );
  }

  reportProgress(requestId, 95, "Finalizing file");
  await output.finalize();
  const mime = (await output.getMimeType().catch(() => null)) ?? "video/mp4";
  const buffer = target.buffer ?? new ArrayBuffer(0);
  reportProgress(requestId, 100, "Export complete");
  return new Blob([buffer], { type: mime });
}

const parseResolution = (value: string) => {
  const map: Record<string, [number, number]> = {
    "720p": [1280, 720],
    "1080p": [1920, 1080],
    "1440p": [2560, 1440],
    "4k": [3840, 2160],
    "2160p": [3840, 2160],
  };
  return map[value.toLowerCase()] ?? [1920, 1080];
};

const pickBitrate = (width: number, height: number, quality: string) => {
  const base =
    width >= 3800 ? 48_000_000 : width >= 2500 ? 28_000_000 : 12_000_000;
  if (quality === "high") return base;
  if (quality === "medium") return Math.round(base * 0.7);
  return Math.round(base * 0.45);
};

const pickAudioBitrate = (quality: string) => {
  if (quality === "high") return 192_000;
  if (quality === "medium") return 160_000;
  return 128_000;
};

const hasAudio = (sequence?: Project["sequences"][number]) => {
  if (!sequence) return false;
  return sequence.tracks.some(
    (track) =>
      track.kind === "audio" ||
      track.clips.some((clip) => clip.kind === "audio"),
  );
};

const reportProgress = (
  requestId: string,
  progress: number,
  status: string,
) => {
  ctx.postMessage({
    type: "ENCODE_PROGRESS",
    requestId,
    progress,
    status,
  });
};

const checkAudioEncoderSupport = async (mimeCodec: string, bitrate: number, sampleRate: number, channels: number): Promise<boolean> => {
  if (typeof AudioEncoder === 'undefined' || typeof AudioEncoder.isConfigSupported !== 'function') {
    console.warn('[EncodeWorker] AudioEncoder.isConfigSupported not available');
    return false;
  }
  
  try {
    const config = {
      codec: mimeCodec, // MIME codec string like 'mp4a.40.2'
      sampleRate,
      numberOfChannels: channels,
      bitrate,
    };
    const result = await AudioEncoder.isConfigSupported(config);
    return result.supported ?? false;
  } catch (error) {
    console.warn('[EncodeWorker] AudioEncoder.isConfigSupported failed for', mimeCodec, error);
    return false;
  }
};

const createAudioSource = async (quality: string) => {
  const baseBitrate = pickAudioBitrate(quality);
  
  // List of codec configurations to try, in order of preference
  // mimeCodec is for browser support checking, codec is for AudioSampleSource
  const codecConfigs = [
    // AAC with original bitrate
    { mimeCodec: 'mp4a.40.2', codec: 'aac' as const, bitrate: baseBitrate, desc: 'AAC' },
    // AAC with lower bitrate
    { mimeCodec: 'mp4a.40.2', codec: 'aac' as const, bitrate: 128_000, desc: 'AAC at 128kbps' },
    // Opus (WebM container)
    { mimeCodec: 'opus', codec: 'opus' as const, bitrate: Math.min(baseBitrate, 192_000), desc: 'Opus' },
    // AAC Low Complexity profile
    { mimeCodec: 'mp4a.40.5', codec: 'aac' as const, bitrate: 128_000, desc: 'AAC-LC at 128kbps' },
  ];
  
  // Check browser support for each config
  for (const config of codecConfigs) {
    const supported = await checkAudioEncoderSupport(
      config.mimeCodec,
      config.bitrate,
      TARGET_SAMPLE_RATE,
      TARGET_CHANNELS
    );
    
    if (supported) {
      console.log('[EncodeWorker] Using', config.desc, 'at', config.bitrate, 'bps');
      try {
        return new AudioSampleSource({
          codec: config.codec,
          bitrate: config.bitrate,
        });
      } catch (error) {
        console.warn('[EncodeWorker] Failed to create AudioSampleSource with', config.desc, ':', error);
        continue;
      }
    } else {
      console.log('[EncodeWorker]', config.desc, 'not supported by browser');
    }
  }
  
  // If all configs failed, throw error
  throw new Error(
    'No supported audio codec configuration found. Tried: ' +
    codecConfigs.map(c => c.desc).join(', ')
  );
};

type RenderContext = {
  videos: Map<string, VideoLoader>;
  images: Map<string, ImageBitmap>;
  lastVideoFrames: Map<string, VideoFrame>; // Hold last frame as fallback
  dispose: () => void;
};

const createRenderContext = (project: Project): RenderContext => {
  const videos = new Map<string, VideoLoader>();
  const images = new Map<string, ImageBitmap>();
  const lastVideoFrames = new Map<string, VideoFrame>();
  return {
    videos,
    images,
    lastVideoFrames,
    dispose: () => {
      videos.forEach((loader) => loader.dispose());
      images.forEach((bitmap) => bitmap.close?.());
      lastVideoFrames.forEach((frame) => frame.close());
      videos.clear();
      images.clear();
      lastVideoFrames.clear();
    },
  };
};

const resolveAssetUrl = (asset: Project["mediaAssets"][string]) => {
  const url = exportUrlForAsset(asset);
  console.log("[Export] Asset URL:", {
    assetId: asset?.id,
    type: asset?.type,
    url,
    hasProxy: !!(asset as any)?.proxyUrl,
    hasOriginal: !!asset?.r2Key,
  });
  return url;
};

const getVideoLoader = async (
  ctx: RenderContext,
  assetId: string,
  asset: Project["mediaAssets"][string],
  clipDuration: number,
) => {
  let loader = ctx.videos.get(assetId);
  if (!loader) {
    console.log(`[Export] Initializing VideoLoader for ${assetId.slice(0, 8)}`);
    // For export: massive cache to hold ALL frames
    loader = new VideoLoader(asset, { cacheSize: 3000, lookaheadSeconds: 0 });
    await loader.init();
    // Decode ALL frames for this clip sequentially (fixes keyframe-only bug)
    console.log(
      `[Export] Pre-decoding ALL frames for ${assetId.slice(0, 8)} (${clipDuration}s)`,
    );
    await loader.decodeSequential(0, clipDuration);
    console.log(`[Export] VideoLoader ready with all frames cached`);
    ctx.videos.set(assetId, loader);
  }
  return loader;
};

const getImageBitmap = async (
  ctx: RenderContext,
  assetId: string,
  asset: Project["mediaAssets"][string],
) => {
  let bitmap = ctx.images.get(assetId);
  if (bitmap) return bitmap;
  const url = resolveAssetUrl(asset);
  if (!url) return undefined;
  const response = await fetch(url);
  const blob = await response.blob();
  bitmap = await createImageBitmap(blob);
  ctx.images.set(assetId, bitmap);
  return bitmap;
};

const renderFrame = async (
  context: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  timelineTime: number,
  tracks: Project["sequences"][number]["tracks"],
  assets: Project["mediaAssets"],
  renderCtx: RenderContext,
) => {
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);

  for (const track of tracks) {
    const clip = track.clips.find(
      (candidate) =>
        timelineTime >= candidate.start &&
        timelineTime < candidate.start + candidate.duration,
    );
    if (!clip) continue;
    if (clip.kind === "audio") continue;
    const asset = assets[clip.mediaId];
    if (!asset) continue;

    const maxPlayable = Number.isFinite(asset.duration)
      ? Math.max(0, asset.duration - clip.trimEnd)
      : Infinity;
    const localTime = Math.min(
      maxPlayable,
      clip.trimStart + Math.max(0, timelineTime - clip.start),
    );

    if (asset.type === "image") {
      const bitmap = await getImageBitmap(renderCtx, clip.mediaId, asset);
      if (bitmap) {
        drawBitmap(context, bitmap, width, height, clip.opacity);
      }
      continue;
    }

    if (asset.type === "video") {
      try {
        // Calculate actual video duration needed for this clip
        const clipVideoDuration = clip.trimStart + clip.duration + clip.trimEnd;
        const loader = await getVideoLoader(
          renderCtx,
          clip.mediaId,
          asset,
          clipVideoDuration,
        );
        let frame = await loader.getFrameAt(localTime);

        if (frame) {
          console.log(
            `[Export] Frame OK: time=${localTime.toFixed(3)}s, clip=${clip.mediaId.slice(0, 8)}`,
          );
          drawVideoFrame(context, frame, width, height, clip.opacity);
          frame.close();
        } else {
          console.warn(
            `[Export] Frame MISSING: time=${localTime.toFixed(3)}s, clip=${clip.mediaId.slice(0, 8)}`,
          );
        }
      } catch (error) {
        console.error(
          `[Export] Frame ERROR: time=${localTime.toFixed(3)}s, clip=${clip.mediaId.slice(0, 8)}`,
          error,
        );
      }
    }
  }
};

const drawVideoFrame = (
  context: OffscreenCanvasRenderingContext2D,
  frame: VideoFrame,
  targetWidth: number,
  targetHeight: number,
  opacity: number,
) => {
  const sourceWidth =
    frame.displayWidth ||
    frame.codedWidth ||
    (frame as any).width ||
    targetWidth;
  const sourceHeight =
    frame.displayHeight ||
    frame.codedHeight ||
    (frame as any).height ||
    targetHeight;
  const scale = Math.max(
    targetWidth / sourceWidth,
    targetHeight / sourceHeight,
  );
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (targetWidth - drawWidth) / 2;
  const offsetY = (targetHeight - drawHeight) / 2;
  context.save();
  context.globalAlpha = opacity;
  context.drawImage(frame, offsetX, offsetY, drawWidth, drawHeight);
  context.restore();
};

const drawBitmap = (
  context: OffscreenCanvasRenderingContext2D,
  bitmap: ImageBitmap,
  targetWidth: number,
  targetHeight: number,
  opacity: number,
) => {
  const { width, height } = bitmap;
  const scale = Math.max(targetWidth / width, targetHeight / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const offsetX = (targetWidth - drawWidth) / 2;
  const offsetY = (targetHeight - drawHeight) / 2;
  context.save();
  context.globalAlpha = opacity;
  context.drawImage(bitmap, offsetX, offsetY, drawWidth, drawHeight);
  context.restore();
};

// Audio helpers

type DecodedAudio = {
  channels: number;
  sampleRate: number;
  data: Float32Array[];
};

const renderAudio = async (
  requestId: string,
  tracks: Project["sequences"][number]["tracks"],
  assets: Project["mediaAssets"],
  audioSource: AudioSampleSource,
  durationSeconds: number,
) => {
  const totalFrames = Math.max(
    1,
    Math.ceil(durationSeconds * TARGET_SAMPLE_RATE),
  );
  const mixBuffers = Array.from(
    { length: TARGET_CHANNELS },
    () => new Float32Array(totalFrames),
  );
  const audioClips = tracks.flatMap((track) =>
    track.clips.filter((clip) => clip.kind === "audio"),
  );

  for (const clip of audioClips) {
    if (!activeRequests.get(requestId)) throw new Error("cancelled");
    const asset = assets[clip.mediaId];
    if (!asset) continue;
    const decoded = await decodeAudioAsset(asset, requestId);
    if (!decoded) continue;
    mixClipIntoBuffers(clip, decoded, mixBuffers, durationSeconds);
    reportProgress(requestId, 93, `Mixed audio clip ${clip.id}`);
  }

  await writeAudioSamples(requestId, audioSource, mixBuffers);
};

const decodeAudioAsset = async (
  asset: Project["mediaAssets"][string],
  requestId: string,
): Promise<DecodedAudio | null> => {
  const url = resolveAssetUrl(asset);
  if (!url) return null;
  const input = new Input({ source: new UrlSource(url), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return null;
    const sink = new AudioSampleSink(track);
    const channelCount = track.numberOfChannels || 1;
    const channelChunks: Float32Array[][] = Array.from(
      { length: channelCount },
      () => [],
    );

    for await (const sample of sink.samples()) {
      if (!activeRequests.get(requestId)) {
        sample.close();
        throw new Error("cancelled");
      }
      const channels = extractSampleChannels(sample);
      channels.forEach((data, idx) => channelChunks[idx]?.push(data));
      sample.close();
    }

    const channelData = channelChunks.map((chunks) => {
      const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const combined = new Float32Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      return combined;
    });

    return {
      channels: channelData.length,
      sampleRate: track.sampleRate ?? TARGET_SAMPLE_RATE,
      data: channelData,
    };
  } finally {
    input.dispose();
  }
};

const extractSampleChannels = (sample: AudioSample) => {
  const channels = sample.numberOfChannels;
  const perChannel: Float32Array[] = [];
  const isPlanar = sample.format.includes("planar");

  if (isPlanar) {
    for (let c = 0; c < channels; c += 1) {
      const dest = new Float32Array(sample.numberOfFrames);
      sample.copyTo(dest, { planeIndex: c, format: "f32-planar" });
      perChannel.push(dest);
    }
    return perChannel;
  }

  const interleaved = new Float32Array(sample.numberOfFrames * channels);
  sample.copyTo(interleaved, { planeIndex: 0, format: "f32" });
  for (let c = 0; c < channels; c += 1) {
    const channel = new Float32Array(sample.numberOfFrames);
    for (let i = 0; i < sample.numberOfFrames; i += 1) {
      channel[i] = interleaved[i * channels + c];
    }
    perChannel.push(channel);
  }
  return perChannel;
};

const mixClipIntoBuffers = (
  clip: Clip,
  decoded: DecodedAudio,
  mixBuffers: Float32Array[],
  totalDuration: number,
) => {
  const { channels, sampleRate, data } = decoded;
  const trimStartFrames = Math.max(0, Math.floor(clip.trimStart * sampleRate));
  const trimEndFrames = Math.max(0, Math.floor(clip.trimEnd * sampleRate));
  const maxFrames = data[0]?.length ?? 0;
  const usableEnd = Math.max(0, maxFrames - trimEndFrames);
  const clipFrames = Math.max(
    0,
    Math.min(
      maxFrames - trimStartFrames,
      Math.floor(clip.duration * sampleRate),
    ),
  );
  const sourceStart = trimStartFrames;
  const sourceEnd = Math.min(usableEnd, sourceStart + clipFrames);
  const sliceLength = Math.max(0, sourceEnd - sourceStart);
  if (sliceLength === 0) return;

  const startFrameTarget = Math.floor(clip.start * TARGET_SAMPLE_RATE);
  const remainingFrames = Math.max(
    0,
    Math.ceil((totalDuration - clip.start) * TARGET_SAMPLE_RATE),
  );
  if (startFrameTarget >= mixBuffers[0].length || remainingFrames === 0) return;
  const maxTargetFrames = Math.min(
    remainingFrames,
    mixBuffers[0].length - startFrameTarget,
  );
  if (maxTargetFrames <= 0) return;

  for (
    let targetChannel = 0;
    targetChannel < TARGET_CHANNELS;
    targetChannel += 1
  ) {
    const sourceChannelIndex = Math.min(targetChannel, channels - 1);
    const sourceChannel = data[sourceChannelIndex].subarray(
      sourceStart,
      sourceEnd,
    );
    const resampled = resampleChannel(
      sourceChannel,
      sampleRate,
      TARGET_SAMPLE_RATE,
      maxTargetFrames,
    );
    const targetBuffer = mixBuffers[targetChannel];
    const writeLength = Math.min(resampled.length, maxTargetFrames);

    for (let i = 0; i < writeLength; i += 1) {
      const targetIndex = startFrameTarget + i;
      if (targetIndex >= targetBuffer.length) break;
      targetBuffer[targetIndex] += resampled[i] * clip.volume;
    }
  }
};

const resampleChannel = (
  source: Float32Array,
  fromRate: number,
  toRate: number,
  maxFrames: number,
): Float32Array => {
  if (fromRate === toRate) {
    return source.length > maxFrames ? source.subarray(0, maxFrames) : source;
  }
  const scale = fromRate / toRate;
  const targetLength = Math.min(
    maxFrames,
    Math.max(1, Math.floor(source.length / scale)),
  );
  const dest = new Float32Array(targetLength);
  for (let i = 0; i < targetLength; i += 1) {
    const sourcePos = i * scale;
    const left = Math.floor(sourcePos);
    const right = Math.min(source.length - 1, left + 1);
    const t = sourcePos - left;
    dest[i] = source[left] * (1 - t) + source[right] * t;
  }
  return dest;
};

const writeAudioSamples = async (
  requestId: string,
  audioSource: AudioSampleSource,
  mixBuffers: Float32Array[],
) => {
  const totalFrames = mixBuffers[0].length;
  const chunkSize = 2048;
  const interleaved = new Float32Array(chunkSize * TARGET_CHANNELS);

  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += chunkSize) {
    if (!activeRequests.get(requestId)) throw new Error("cancelled");
    const framesThisChunk = Math.min(chunkSize, totalFrames - frameIndex);
    for (let i = 0; i < framesThisChunk; i += 1) {
      for (let ch = 0; ch < TARGET_CHANNELS; ch += 1) {
        interleaved[i * TARGET_CHANNELS + ch] = mixBuffers[ch][frameIndex + i];
      }
    }
    const sample = new AudioSample({
      data: interleaved.slice(0, framesThisChunk * TARGET_CHANNELS),
      format: "f32",
      numberOfChannels: TARGET_CHANNELS,
      sampleRate: TARGET_SAMPLE_RATE,
      timestamp: frameIndex / TARGET_SAMPLE_RATE,
    });
    await audioSource.add(sample);
    sample.close();
  }
};
