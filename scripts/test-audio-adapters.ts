"use strict";

import { FreesoundAudioAdapter } from "../lib/adapters/freesound-audio";
import { ReplicateMusicAdapter } from "../lib/adapters/replicate-music";
import { ReplicateVoiceAdapter } from "../lib/adapters/replicate-voice";

const logDivider = () => {
  console.log("\n" + "-".repeat(60) + "\n");
};

const runFreesoundTest = async () => {
  console.log("▶︎ Testing FreesoundAudioAdapter");
  try {
    const adapter = new FreesoundAudioAdapter("freesound-music-library");
    const results = await adapter.searchLibrary({
      query: "uplifting cinematic",
      perPage: 3,
    });
    console.log(
      "[Freesound Test] Received results:",
      results.map((result) => ({
        id: result.id,
        title: result.title,
        duration: result.durationSeconds,
        streamUrl: result.streamUrl,
      })),
    );
  } catch (error) {
    console.error("[Freesound Test] Failed:", error);
  }
  logDivider();
};

const shouldRunReplicateTests =
  ["1", "true"].includes(
    (process.env.RUN_REPLICATE_TESTS || "").toLowerCase(),
  ) && Boolean(process.env.REPLICATE_API_KEY);

const runReplicateMusicTest = async () => {
  if (!shouldRunReplicateTests) {
    console.warn(
      "[MusicGen Test] Skipped. Set RUN_REPLICATE_TESTS=1 and provide REPLICATE_API_KEY to enable.",
    );
    logDivider();
    return;
  }

  console.log("▶︎ Testing ReplicateMusicAdapter");
  try {
    const adapter = new ReplicateMusicAdapter("musicgen-large");
    const track = await adapter.generateTrack({
      prompt: "intimate piano arpeggios with gentle strings",
      durationSeconds: 4,
    });
    console.log("[MusicGen Test] Track response:", track);
  } catch (error) {
    console.error("[MusicGen Test] Failed:", error);
  }
  logDivider();
};

const runReplicateVoiceTest = async () => {
  if (!shouldRunReplicateTests) {
    console.warn(
      "[Voice Test] Skipped. Set RUN_REPLICATE_TESTS=1 and provide REPLICATE_API_KEY to enable.",
    );
    logDivider();
    return;
  }

  console.log("▶︎ Testing ReplicateVoiceAdapter");
  try {
    const adapter = new ReplicateVoiceAdapter("replicate-minimax-tts");
    const response = await adapter.synthesizeVoice({
      text: "This is a short systems check for the MiniMax narrator.",
      voiceId: "Wise_Woman",
      emotion: "calm",
      speed: 1,
      pitch: 0,
    });
    console.log("[Voice Test] Voice response:", response);
  } catch (error) {
    console.error("[Voice Test] Failed:", error);
  }
  logDivider();
};

(async () => {
  await runFreesoundTest();
  await runReplicateMusicTest();
  await runReplicateVoiceTest();
})();
