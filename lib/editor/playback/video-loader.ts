import {
  ALL_FORMATS,
  EncodedPacketSink,
  Input,
  UrlSource,
} from "mediabunny";
import { playbackUrlForAsset } from "../io/asset-url";
import { FrameCache } from "./frame-cache";
import type { MediaAssetMeta } from "../types";

type VideoLoaderOptions = {
  cacheSize?: number;
  lookaheadSeconds?: number;
  requestInit?: RequestInit;
};

const MICROSECONDS = 1_000_000;

export class VideoLoader {
  private input?: Input;
  private sink?: EncodedPacketSink;
  private decoder?: VideoDecoder;
  private decoderConfig: VideoDecoderConfig | null = null;
  private readonly cache: FrameCache<VideoFrame>;
  private readonly lookahead: number;
  private readonly requestInit?: RequestInit;
  private lastAnchor = 0;

  private async buildInput(url: string) {
    return new Input({
      source: new UrlSource(url, {
        requestInit: this.requestInit,
        maxCacheSize: 64 * 1024 * 1024, // allow range seeks without thrashing
      }),
      formats: ALL_FORMATS,
    });
  }

  constructor(private readonly asset: MediaAssetMeta, options?: VideoLoaderOptions) {
    this.lookahead = options?.lookaheadSeconds ?? 0.75;
    this.cache = new FrameCache<VideoFrame>(options?.cacheSize ?? 48);
    this.requestInit = options?.requestInit;
  }

  async init() {
    if (this.decoder && this.sink && this.input) return;
    if (typeof VideoDecoder === "undefined") {
      throw new Error("WebCodecs VideoDecoder not available in this environment");
    }

    // Prefer proxy URLs, then fall back to original/source URLs if proxy is broken/expired.
    const preferredUrl = playbackUrlForAsset(this.asset);
    const fallbackUrls = Array.from(
      new Set(
        [
          preferredUrl,
          this.asset.sourceUrl,
          this.asset.url,
        ].filter(Boolean),
      ),
    ) as string[];

    let track: Awaited<ReturnType<Input["getPrimaryVideoTrack"]>> | null = null;
    for (const candidate of fallbackUrls) {
      try {
        this.input?.dispose();
        this.input = await this.buildInput(candidate);
        track = await this.input.getPrimaryVideoTrack();
        if (track) break;
      } catch (error) {
        console.warn("VideoLoader fallback failed for URL", candidate, error);
        continue;
      }
    }

    if (!track) {
      throw new Error("No video track found in asset");
    }

    this.sink = new EncodedPacketSink(track);
    this.decoderConfig = await track.getDecoderConfig();
    if (!this.decoderConfig) {
      throw new Error("Video codec unsupported by browser");
    }

    this.reconfigureDecoder();
  }

  async getFrameAt(timeSeconds: number): Promise<VideoFrame | null> {
    await this.init();
    const cacheKey = this.keyFor(timeSeconds);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.clone();
    }

    await this.decodeAround(timeSeconds);
    const decoded = this.cache.get(cacheKey);
    if (decoded) {
      return decoded.clone();
    }
    
    // Fallback: Find nearest frame within tolerance (50ms)
    // This handles timestamp precision mismatches
    const nearestFrame = this.getNearestFrame(timeSeconds, 0.05);
    if (nearestFrame) {
      // Only log occasionally to avoid spam
      if (Math.random() < 0.05) {
        console.log('[VideoLoader] Using nearest frame for', timeSeconds.toFixed(6), '- exact match not found, cache size:', this.cache.size);
      }
      return nearestFrame;
    }
    
    console.error('[VideoLoader] No frame found near', timeSeconds.toFixed(6), 's - cache size:', this.cache.size, 'cache keys:', Array.from(this.cache.entries()).slice(0, 5).map(([k]) => k));
    return null;
  }
  
  private getNearestFrame(timeSeconds: number, toleranceSeconds: number): VideoFrame | null {
    let nearestFrame: VideoFrame | null = null;
    let nearestDelta = Infinity;
    
    for (const [key, frame] of this.cache.entries()) {
      const frameTime = Number.parseFloat(key);
      if (!Number.isFinite(frameTime)) continue;
      
      const delta = Math.abs(frameTime - timeSeconds);
      if (delta <= toleranceSeconds && delta < nearestDelta) {
        nearestDelta = delta;
        nearestFrame = frame;
      }
    }
    
    return nearestFrame ? nearestFrame.clone() : null;
  }

  async seek(timeSeconds: number) {
    await this.init();
    this.lastAnchor = timeSeconds;
    await this.decoder?.flush().catch(() => undefined);
    this.decoder?.reset();
    this.reconfigureDecoder();
    this.cache.clear();
    await this.decodeAround(timeSeconds);
  }

  dispose() {
    this.cache.clear();
    this.decoder?.close();
    this.input?.dispose();
  }

  private async decodeAround(timeSeconds: number) {
    if (!this.decoder || !this.sink) return;
    this.lastAnchor = timeSeconds;

    await this.decoder.flush().catch(() => undefined);
    const keyPacket = await this.sink.getKeyPacket(timeSeconds, { verifyKeyPackets: true });
    if (!keyPacket) return;

    let packet: any | null = keyPacket;
    const endTimestamp = timeSeconds + this.lookahead;
    while (packet && packet.timestamp <= endTimestamp) {
      // Skip metadata-only packets
      if (!packet.isMetadataOnly && packet.byteLength > 0) {
        this.decoder.decode(packet.toEncodedVideoChunk());
      }
      packet = await this.sink.getNextPacket(packet);
    }

    await this.decoder.flush();
    this.trimCache(timeSeconds);
  }

  private handleDecodedFrame(frame: VideoFrame) {
    const seconds = (frame.timestamp ?? 0) / MICROSECONDS;
    const key = this.keyFor(seconds);
    // Close any existing frame at the same timestamp before replacing.
    void this.cache.put(key, frame);
    this.trimCache(this.lastAnchor);
  }

  private trimCache(anchorSeconds: number) {
    const min = anchorSeconds - this.lookahead;
    const max = anchorSeconds + this.lookahead;
    this.cache.sweep((key) => {
      const ts = Number.parseFloat(key);
      return Number.isFinite(ts) && (ts < min || ts > max);
    });
  }

  private keyFor(timeSeconds: number) {
    // Use microsecond precision to better match video frame timestamps
    // This reduces cache misses caused by floating-point precision issues
    return timeSeconds.toFixed(6);
  }

  private reconfigureDecoder() {
    const config = this.decoderConfig;
    if (!config) return;
    if (!this.decoder || this.decoder.state === "closed") {
      this.decoder = new VideoDecoder({
        output: (frame) => this.handleDecodedFrame(frame),
        error: (error) => console.error("VideoDecoder error", error),
      });
    }
    this.decoder.configure(config);
  }
}
