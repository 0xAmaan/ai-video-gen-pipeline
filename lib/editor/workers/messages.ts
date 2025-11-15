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

export type DemuxWorkerMessage =
  | DemuxRequestMessage
  | DemuxResponseMessage
  | DemuxErrorMessage
  | DemuxProgressMessage;

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
  sequenceId: string;
  settings: {
    resolution: string;
    quality: string;
    format: string;
  };
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

export type EffectsWorkerMessage = EffectsRequestMessage | EffectsResponseMessage;
export type EncodeWorkerMessage =
  | EncodeRequestMessage
  | EncodeProgressMessage
  | EncodeResultMessage
  | EncodeErrorMessage
  | EncodeCancelMessage;
