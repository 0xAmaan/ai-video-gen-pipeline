import type { MediaAssetMeta } from "../types";

export interface DemuxRequestMessage {
  type: "DEMUX_REQUEST";
  requestId: string;
  file: File;
  assetId: string;
}

export interface DemuxProgressMessage {
  type: "DEMUX_PROGRESS";
  requestId: string;
  progress: number;
  detail?: string;
}

export interface DemuxResponseMessage {
  type: "DEMUX_RESULT";
  requestId: string;
  asset: MediaAssetMeta;
  assetId: string;
  waveform?: Float32Array;
}

export interface DemuxErrorMessage {
  type: "DEMUX_ERROR";
  requestId: string;
  error: string;
}

export interface ThumbnailRequestMessage {
  type: "THUMBNAIL_REQUEST";
  requestId: string;
  assetId: string;
  mediaUrl: string;
  duration: number;
  count: number; // Number of thumbnails to generate
}

export interface ThumbnailProgressMessage {
  type: "THUMBNAIL_PROGRESS";
  requestId: string;
  progress: number;
  current: number;
  total: number;
}

export interface ThumbnailResponseMessage {
  type: "THUMBNAIL_RESULT";
  requestId: string;
  assetId: string;
  thumbnails: string[]; // R2 URLs (or data URLs as fallback)
}

export interface ThumbnailErrorMessage {
  type: "THUMBNAIL_ERROR";
  requestId: string;
  error: string;
}

export type DemuxWorkerMessage =
  | DemuxRequestMessage
  | DemuxResponseMessage
  | DemuxErrorMessage
  | DemuxProgressMessage
  | ThumbnailRequestMessage
  | ThumbnailProgressMessage
  | ThumbnailResponseMessage
  | ThumbnailErrorMessage;

export interface EffectsRequestMessage {
  type: "EFFECTS_REQUEST";
  requestId: string;
  clipId: string;
  payload: Record<string, unknown>;
}

export interface EffectsResponseMessage {
  type: "EFFECTS_RESULT";
  requestId: string;
  values: number[];
}

export interface EncodeRequestMessage {
  type: "ENCODE_REQUEST";
  requestId: string;
  project: import("../types").Project;
  sequenceId: string;
  sequence: any; // Full sequence data
  assets: Record<string, any>; // Media assets
  settings: {
    resolution: string;
    quality: string;
    format: string;
    aspectRatio: string;
    includeAudio?: boolean;
  };
}

export interface EncodeFrameMessage {
  type: "ENCODE_FRAME";
  requestId: string;
  frameData: ImageData;
  timestamp: number;
}

export interface EncodeCompleteMessage {
  type: "ENCODE_COMPLETE";
  requestId: string;
}

export interface EncodeProgressMessage {
  type: "ENCODE_PROGRESS";
  requestId: string;
  progress: number;
  status: string;
}

export interface EncodeResultMessage {
  type: "ENCODE_RESULT";
  requestId: string;
  blob: Blob;
}

export interface EncodeErrorMessage {
  type: "ENCODE_ERROR";
  requestId: string;
  error: string;
}

export interface EncodeCancelMessage {
  type: "ENCODE_CANCEL";
  requestId: string;
}

export type EffectsWorkerMessage =
  | EffectsRequestMessage
  | EffectsResponseMessage;
export type EncodeWorkerMessage =
  | EncodeRequestMessage
  | EncodeFrameMessage
  | EncodeCompleteMessage
  | EncodeProgressMessage
  | EncodeResultMessage
  | EncodeErrorMessage
  | EncodeCancelMessage;
