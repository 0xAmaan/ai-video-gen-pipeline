import type { Sequence } from "../types";
import type {
  EncodeWorkerMessage,
  EncodeRequestMessage,
  EncodeCancelMessage,
} from "../workers/messages";

export type ExportOptions = {
  resolution: string;
  quality: string;
  format: string;
};

export type ExportProgressHandler = (progress: number, status: string) => void;

export class ExportPipeline {
  private worker: Worker;
  private pending = new Map<
    string,
    { resolve: (blob: Blob) => void; reject: (error: Error) => void; onProgress?: ExportProgressHandler }
  >();

  constructor() {
    this.worker = new Worker(new URL("../workers/encode-worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.onmessage = (event: MessageEvent<EncodeWorkerMessage>) => {
      const message = event.data;
      if (message.type === "ENCODE_PROGRESS") {
        const pending = this.pending.get(message.requestId);
        pending?.onProgress?.(message.progress, message.status);
        return;
      }
      if (message.type === "ENCODE_RESULT") {
        const pending = this.pending.get(message.requestId);
        if (!pending) return;
        this.pending.delete(message.requestId);
        pending.resolve(message.blob);
        return;
      }
      if (message.type === "ENCODE_ERROR") {
        const pending = this.pending.get(message.requestId);
        if (!pending) return;
        this.pending.delete(message.requestId);
        pending.reject(new Error(message.error));
      }
    };
  }

  exportSequence(sequence: Sequence, options: ExportOptions, onProgress?: ExportProgressHandler) {
    const requestId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const payload: EncodeRequestMessage = {
      type: "ENCODE_REQUEST",
      requestId,
      sequenceId: sequence.id,
      settings: options,
    };
    return new Promise<Blob>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject, onProgress });
      this.worker.postMessage(payload);
    });
  }

  cancel(requestId: string) {
    const cancelPayload: EncodeCancelMessage = { type: "ENCODE_CANCEL", requestId };
    this.worker.postMessage(cancelPayload);
    const pending = this.pending.get(requestId);
    if (pending) {
      this.pending.delete(requestId);
      pending.reject(new Error("cancelled"));
    }
  }
}

let pipelineSingleton: ExportPipeline | null = null;
const canUseWorkers = typeof window !== "undefined" && typeof window.Worker !== "undefined";

export const getExportPipeline = (): ExportPipeline => {
  if (!canUseWorkers) {
    throw new Error("Export pipeline is only available in the browser");
  }
  if (!pipelineSingleton) {
    pipelineSingleton = new ExportPipeline();
  }
  return pipelineSingleton;
};
