/// <reference lib="webworker" />

import { Input, BlobSource, ALL_FORMATS, AudioBufferSink } from "mediabunny";
import type {
  DemuxRequestMessage,
  DemuxResponseMessage,
  DemuxWorkerMessage,
} from "./messages";
import type { MediaAssetMeta } from "../types";

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
const canBuildWaveform = typeof (globalThis as unknown as { AudioBuffer?: unknown }).AudioBuffer === "function";

ctx.onmessage = async (event: MessageEvent<DemuxWorkerMessage>) => {
  const message = event.data;
  if (message.type !== "DEMUX_REQUEST") {
    return;
  }

  const { file, requestId, assetId } = message;

  try {
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const duration = await input.computeDuration();
    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    const packetStats = videoTrack ? await videoTrack.computePacketStats(240) : null;
    const waveform = audioTrack ? await safeBuildWaveform(audioTrack, duration) : undefined;

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

async function safeBuildWaveform(audioTrack: any, duration: number): Promise<Float32Array | undefined> {
  if (!canBuildWaveform) {
    return undefined;
  }
  try {
    return await buildWaveform(audioTrack, duration);
  } catch (error) {
    console.warn?.("Waveform generation skipped:", error);
    return undefined;
  }
}

async function buildWaveform(audioTrack: any, duration: number): Promise<Float32Array> {
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
