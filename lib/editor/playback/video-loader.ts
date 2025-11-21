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

    const url = playbackUrlForAsset(this.asset);
    if (!url) {
      throw new Error("VideoLoader requires a resolvable asset URL");
    }

    this.input = new Input({
      source: new UrlSource(url, {
        requestInit: this.requestInit,
        maxCacheSize: 64 * 1024 * 1024, // allow range seeks without thrashing
      }),
      formats: ALL_FORMATS,
    });

    const track = await this.input.getPrimaryVideoTrack();
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
    return decoded ? decoded.clone() : null;
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
