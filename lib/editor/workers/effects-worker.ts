/// <reference lib="webworker" />

import type { EffectsRequestMessage, EffectsWorkerMessage } from "./messages";

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<EffectsWorkerMessage>) => {
  const message = event.data;
  if (message.type !== "EFFECTS_REQUEST") return;
  const values: number[] = [];
  for (let i = 0; i < 16; i += 1) {
    values.push(Math.random());
  }
  ctx.postMessage({
    type: "EFFECTS_RESULT",
    requestId: message.requestId,
    values,
  });
};
