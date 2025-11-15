/// <reference lib="webworker" />

import type { EncodeRequestMessage, EncodeWorkerMessage } from "./messages";

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
const activeRequests = new Map<string, boolean>();

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
  const { requestId, sequenceId, settings } = message as EncodeRequestMessage;
  activeRequests.set(requestId, true);
  for (let progress = 0; progress <= 100; progress += 10) {
    if (!activeRequests.get(requestId)) {
      return;
    }
    ctx.postMessage({
      type: "ENCODE_PROGRESS",
      requestId,
      progress,
      status: `Encoding ${progress}%`,
    });
    await delay(200);
  }
  if (!activeRequests.get(requestId)) return;
  const blob = new Blob([
    JSON.stringify({ sequenceId, settings, generatedAt: Date.now() }, null, 2),
  ]);
  ctx.postMessage({ type: "ENCODE_RESULT", requestId, blob });
  activeRequests.delete(requestId);
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
