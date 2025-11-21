import type { MediaAssetMeta } from "../types";
import { buildAssetUrl } from "./asset-url";
import type {
  DemuxErrorMessage,
  DemuxRequestMessage,
  DemuxResponseMessage,
  DemuxWorkerMessage,
  ThumbnailRequestMessage,
  ThumbnailResponseMessage,
} from "../workers/messages";

export class MediaBunnyManager {
  private worker: Worker;
  private inflight = new Map<
    string,
    {
      resolve: (asset: MediaAssetMeta) => void;
      reject: (error: Error) => void;
      objectUrl: string;
    }
  >();
  private thumbnailRequests = new Map<
    string,
    { resolve: (thumbnails: string[]) => void; reject: (error: Error) => void }
  >();

  constructor() {
    this.worker = new Worker(
      new URL("../workers/demux-worker.ts", import.meta.url),
      {
        type: "module",
      },
    );
    this.worker.onmessage = (event: MessageEvent<DemuxWorkerMessage>) => {
      const message = event.data;
      if (message.type === "DEMUX_RESULT") {
        const pending = this.inflight.get(message.requestId);
        if (!pending) return;
        this.inflight.delete(message.requestId);
        const asset = {
          ...message.asset,
          id: message.assetId,
          url: buildAssetUrl(message.asset.r2Key, pending.objectUrl),
          proxyUrl: buildAssetUrl(message.asset.r2Key, pending.objectUrl),
          r2Key: message.asset.r2Key,
          sourceUrl: pending.objectUrl,
        };
        if (message.waveform) {
          asset.waveform = message.waveform;
        }
        pending.resolve(asset);
        return;
      }
      if (message.type === "DEMUX_ERROR") {
        const pending = this.inflight.get(message.requestId);
        if (!pending) return;
        this.inflight.delete(message.requestId);
        pending.reject(new Error(message.error));
        return;
      }
      if (message.type === "THUMBNAIL_PROGRESS") {
        // Handle progress updates (for future progress UI)
        return;
      }
      if (message.type === "THUMBNAIL_RESULT") {
        const pending = this.thumbnailRequests.get(message.requestId);
        if (!pending) return;
        this.thumbnailRequests.delete(message.requestId);
        pending.resolve(message.thumbnails);
        return;
      }
      if (message.type === "THUMBNAIL_ERROR") {
        const pending = this.thumbnailRequests.get(message.requestId);
        if (!pending) return;
        this.thumbnailRequests.delete(message.requestId);
        pending.reject(new Error(message.error));
        return;
      }
    };
  }

  importFile(file: File): Promise<MediaAssetMeta> {
    const requestId =
      crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const assetId = `asset-${requestId}`;
    const objectUrl = URL.createObjectURL(file);
    return new Promise<MediaAssetMeta>((resolve, reject) => {
      this.inflight.set(requestId, { resolve, reject, objectUrl });
      const message: DemuxRequestMessage = {
        type: "DEMUX_REQUEST",
        requestId,
        assetId,
        file,
      };
      this.worker.postMessage(message);
    });
  }

  generateThumbnails(
    assetId: string,
    mediaUrl: string,
    duration: number,
    count: number = 15,
  ): Promise<string[]> {
    const requestId =
      crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    return new Promise<string[]>((resolve, reject) => {
      this.thumbnailRequests.set(requestId, { resolve, reject });
      const message: ThumbnailRequestMessage = {
        type: "THUMBNAIL_REQUEST",
        requestId,
        assetId,
        mediaUrl,
        duration,
        count,
      };
      this.worker.postMessage(message);
    });
  }

  dispose() {
    this.worker.terminate();
    this.inflight.forEach(({ reject, objectUrl }) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("MediaBunnyManager disposed"));
    });
    this.inflight.clear();
    this.thumbnailRequests.forEach(({ reject }) => {
      reject(new Error("MediaBunnyManager disposed"));
    });
    this.thumbnailRequests.clear();
  }
}

let singleton: MediaBunnyManager | null = null;

const canUseWorkers =
  typeof window !== "undefined" && typeof window.Worker !== "undefined";

export const getMediaBunnyManager = (): MediaBunnyManager => {
  if (!canUseWorkers) {
    throw new Error("MediaBunnyManager is only available in the browser");
  }
  if (!singleton) {
    singleton = new MediaBunnyManager();
  }
  return singleton;
};
