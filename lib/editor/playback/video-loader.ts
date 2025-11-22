import { ALL_FORMATS, EncodedPacketSink, Input, UrlSource } from "mediabunny";
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
  private disableTrimming = false; // For export mode - keep all frames

  private async buildInput(url: string) {
    return new Input({
      source: new UrlSource(url, {
        requestInit: this.requestInit,
        maxCacheSize: 64 * 1024 * 1024, // allow range seeks without thrashing
      }),
      formats: ALL_FORMATS,
    });
  }

  constructor(
    private readonly asset: MediaAssetMeta,
    options?: VideoLoaderOptions,
  ) {
    this.lookahead = options?.lookaheadSeconds ?? 0.75;
    this.cache = new FrameCache<VideoFrame>(options?.cacheSize ?? 48);
    this.requestInit = options?.requestInit;
  }

  async init() {
    if (this.decoder && this.sink && this.input) return;
    if (typeof VideoDecoder === "undefined") {
      throw new Error(
        "WebCodecs VideoDecoder not available in this environment",
      );
    }

    // Prefer proxy URLs, then fall back to original/source URLs if proxy is broken/expired.
    const preferredUrl = playbackUrlForAsset(this.asset);
    const fallbackUrls = Array.from(
      new Set(
        [preferredUrl, this.asset.sourceUrl, this.asset.url].filter(Boolean),
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

    // If we don't have an exact match, try to use the nearest decoded frame.
    // WebCodecs frame timestamps rarely line up exactly with arbitrary
    // playback times, so relying only on exact millisecond-aligned keys will
    // frequently miss and cause black frames.
    const nearestBeforeDecode = this.cache.findNearest(timeSeconds);
    if (nearestBeforeDecode) {
      console.log(
        `[VideoLoader] Using nearest cached frame for ${timeSeconds.toFixed(
          3,
        )}s (pre-decode)`,
      );
      return nearestBeforeDecode.clone();
    }

    await this.decodeAround(timeSeconds);
    // After decoding around the target time, prefer an exact key if present,
    // otherwise fall back to the nearest available frame.
    const decodedExact = this.cache.get(cacheKey);
    if (decodedExact) {
      return decodedExact.clone();
    }

    const nearestAfterDecode = this.cache.findNearest(timeSeconds);
    if (nearestAfterDecode) {
      console.log(
        `[VideoLoader] Using nearest decoded frame for ${timeSeconds.toFixed(
          3,
        )}s (post-decode)`,
      );
      return nearestAfterDecode.clone();
    }

    return null;
  }

  async decodeSequential(
    startSeconds: number,
    endSeconds: number,
  ): Promise<void> {
    if (!this.decoder || !this.sink) return;

    // Disable cache trimming for sequential decode
    this.disableTrimming = true;
    console.log(
      `[VideoLoader] decodeSequential ${startSeconds}s to ${endSeconds}s - trimming DISABLED`,
    );

    await this.decoder.flush().catch(() => undefined);

    // Find the keyframe at or before start
    const keyPacket = await this.sink.getKeyPacket(startSeconds, {
      verifyKeyPackets: true,
    });
    if (!keyPacket) return;

    // Decode ALL packets from keyframe to end
    let packet: any | null = keyPacket;
    const endTimestamp = endSeconds;

    while (packet && packet.timestamp <= endTimestamp) {
      if (!packet.isMetadataOnly && packet.byteLength > 0) {
        this.decoder.decode(packet.toEncodedVideoChunk());
      }
      packet = await this.sink.getNextPacket(packet);
    }

    await this.decoder.flush();
    console.log(
      `[VideoLoader] decodeSequential complete, cache size: ${this.cache.size()}`,
    );
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

  setPlaybackMode(isPlaying: boolean): void {
    this.disableTrimming = isPlaying;
    console.log(
      `[VideoLoader] Playback mode: ${isPlaying}, trimming: ${!isPlaying}`,
    );
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
    const keyPacket = await this.sink.getKeyPacket(timeSeconds, {
      verifyKeyPackets: true,
    });
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
    console.log(
      `[VideoLoader] Decoded frame at ${seconds.toFixed(3)}s, cacheKey=${key}`,
    );
    // Close any existing frame at the same timestamp before replacing.
    void this.cache.put(key, frame);

    // Skip trimming if disabled (export mode)
    if (this.disableTrimming) {
      console.log(
        `[VideoLoader] Trimming disabled, cache size: ${this.cache.size()}`,
      );
      return;
    }

    console.log(`[VideoLoader] Cache size before trim: ${this.cache.size()}`);
    this.trimCache(this.lastAnchor);
    console.log(
      `[VideoLoader] Cache size after trim: ${this.cache.size()}, lastAnchor=${this.lastAnchor.toFixed(3)}s, lookahead=${this.lookahead.toFixed(3)}s`,
    );
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
    // Normalize to millisecond precision for cache hits.
    return timeSeconds.toFixed(3);
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
