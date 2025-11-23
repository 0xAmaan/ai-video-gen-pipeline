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
  private decodeInProgress = false; // Prevent concurrent decode operations

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
    this.lookahead = options?.lookaheadSeconds ?? 3.0; // Increased from 0.75s to 3.0s
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

  async getVideoDimensions(): Promise<{ width: number; height: number }> {
    await this.init();

    // Decode first frame to get dimensions
    const firstFrame = await this.getFrameAt(0);
    if (!firstFrame) {
      throw new Error("Could not decode first frame to get dimensions");
    }

    const dimensions = {
      width: firstFrame.displayWidth,
      height: firstFrame.displayHeight,
    };

    firstFrame.close();
    return dimensions;
  }

  async getFrameAt(timeSeconds: number): Promise<VideoFrame | null> {
    await this.init();
    const cacheKey = this.keyFor(timeSeconds);

    // Check exact cache hit first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.clone();
    }

    // Decide if we need to decode more frames
    const shouldDecode = this.shouldDecodeAround(timeSeconds);

    if (shouldDecode && !this.decodeInProgress) {
      await this.decodeAround(timeSeconds);
    }

    // After potential decode, try exact match again
    const decodedExact = this.cache.get(cacheKey);
    if (decodedExact) {
      return decodedExact.clone();
    }

    // Fall back to nearest available frame
    const nearest = this.cache.findNearest(timeSeconds);
    if (nearest) {
      return nearest.clone();
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
    // Don't reconfigure here - decodeAround() will handle it with proper keyframe
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

  private shouldDecodeAround(timeSeconds: number): boolean {
    // If cache is empty, definitely need to decode
    if (this.cache.size() === 0) return true;

    // If time is far from last anchor, need to decode new window
    // Using 0.3 (30%) instead of 0.5 (50%) for more preemptive decoding
    const distanceFromAnchor = Math.abs(timeSeconds - this.lastAnchor);
    if (distanceFromAnchor > this.lookahead * 0.3) {
      console.log(
        `[VideoLoader] Time ${timeSeconds.toFixed(3)}s is ${distanceFromAnchor.toFixed(3)}s from anchor ${this.lastAnchor.toFixed(3)}s, re-decoding`,
      );
      return true;
    }

    return false;
  }

  private async decodeAround(timeSeconds: number) {
    if (!this.decoder || !this.sink) return;

    // Don't skip concurrent requests - they're queued in getFrameAt()
    if (this.decodeInProgress) {
      return;
    }

    this.decodeInProgress = true;
    try {
      this.lastAnchor = timeSeconds;

      await this.decoder.flush().catch(() => undefined);

      // Only reconfigure if decoder is closed or not configured
      if (
        this.decoder.state === "closed" ||
        this.decoder.state === "unconfigured"
      ) {
        this.reconfigureDecoder();
      }

      // Try to get keyframe at requested time
      let keyPacket = await this.sink.getKeyPacket(timeSeconds, {
        verifyKeyPackets: true,
      });

      // If no keyframe found at requested time and we're near the beginning, try time 0
      if (!keyPacket && timeSeconds < 1.0) {
        console.log(
          "[VideoLoader] No keyframe at",
          timeSeconds,
          "trying from start",
        );
        keyPacket = await this.sink.getKeyPacket(0, {
          verifyKeyPackets: true,
        });
      }

      if (!keyPacket) {
        console.error("[VideoLoader] No keyframe found at", timeSeconds);
        return;
      }

      // Verify it's actually a keyframe
      if (keyPacket.type !== "key") {
        console.error(
          "[VideoLoader] Packet is not a keyframe:",
          keyPacket.type,
        );
        return;
      }

      let packet: any | null = keyPacket;
      const endTimestamp = timeSeconds + this.lookahead;
      let isFirstPacket = true;

      while (packet && packet.timestamp <= endTimestamp) {
        // Skip metadata-only packets
        if (!packet.isMetadataOnly && packet.byteLength > 0) {
          // Extra safety: verify first packet is keyframe
          if (isFirstPacket) {
            if (packet.type !== "key") {
              console.error(
                "[VideoLoader] First packet after config/flush is not a keyframe, skipping decode",
                { type: packet.type, timestamp: packet.timestamp },
              );
              break;
            }
            console.log(
              "[VideoLoader] Starting decode with keyframe at",
              packet.timestamp,
            );
          }

          // Only decode if decoder is in configured state
          if (this.decoder.state !== "configured") {
            console.error(
              "[VideoLoader] Decoder not in configured state:",
              this.decoder.state,
              "packet type:",
              packet.type,
            );
            break;
          }

          this.decoder.decode(packet.toEncodedVideoChunk());
          isFirstPacket = false;
        }
        packet = await this.sink.getNextPacket(packet);
      }

      await this.decoder.flush();
      this.trimCache(timeSeconds);
    } finally {
      this.decodeInProgress = false;
    }
  }

  private handleDecodedFrame(frame: VideoFrame) {
    const seconds = (frame.timestamp ?? 0) / MICROSECONDS;
    const key = this.keyFor(seconds);
    // Close any existing frame at the same timestamp before replacing.
    void this.cache.put(key, frame);

    // Skip trimming if disabled (export mode)
    if (this.disableTrimming) {
      return;
    }

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
    if (!config) {
      console.error(
        "[VideoLoader] Cannot reconfigure decoder: no decoder config",
      );
      return;
    }

    if (!this.decoder || this.decoder.state === "closed") {
      this.decoder = new VideoDecoder({
        output: (frame) => this.handleDecodedFrame(frame),
        error: (error) => {
          console.error("VideoDecoder error", error);
          console.error("Asset URL:", this.asset.url);
          console.error("Decoder state:", this.decoder?.state);
        },
      });
    }

    try {
      this.decoder.configure(config);
      console.log("[VideoLoader] Decoder configured for asset:", this.asset.id);
    } catch (error) {
      console.error("[VideoLoader] Failed to configure decoder:", error);
      console.error("Config:", config);
      console.error("Asset:", this.asset);
      throw error;
    }
  }
}
