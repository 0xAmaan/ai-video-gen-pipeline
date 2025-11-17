import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AUDIO_MODELS,
  type AudioVendor,
} from "@/lib/audio-models";
import { sanitizeNarrationText } from "@/lib/narration";
import { getVoiceAdapter } from "@/lib/audio-provider-factory";
import { getConvexClient } from "@/lib/server/convex";

const isAudioVendor = (value: unknown): value is AudioVendor =>
  typeof value === "string" &&
  ["replicate", "elevenlabs", "freesound", "local"].includes(value);

const isAudioModelKey = (
  value: unknown,
): value is keyof typeof AUDIO_MODELS =>
  typeof value === "string" && value in AUDIO_MODELS;

const stripSSML = (value: string) => value.replace(/<[^>]+>/g, " ");

export async function POST(req: Request) {
  try {
    const {
      sceneId,
      text,
      voiceId,
      emotion = "auto",
      speed = 1,
      pitch = 0,
      provider,
      voiceModelKey,
      ssml,
      outputFormat,
    } = await req.json();

    if (!sceneId || typeof sceneId !== "string") {
      return NextResponse.json({ error: "sceneId is required" }, { status: 400 });
    }

    if ((!text || typeof text !== "string") && typeof ssml !== "string") {
      return NextResponse.json(
        { error: "Narration text or SSML is required" },
        { status: 400 },
      );
    }

    const resolvedVendor = isAudioVendor(provider) ? provider : undefined;
    const adapter = getVoiceAdapter({
      vendor: resolvedVendor,
      modelKey: isAudioModelKey(voiceModelKey) ? voiceModelKey : undefined,
    });

    const ssmlInput =
      typeof ssml === "string" && ssml.trim().length > 0 ? ssml : undefined;
    const textInput =
      typeof text === "string" && text.trim().length > 0 ? text.trim() : "";
    const baseText = ssmlInput ? stripSSML(ssmlInput) : textInput;

    const { text: sanitizedText, truncated } = sanitizeNarrationText(baseText);
    if (!sanitizedText) {
      return NextResponse.json(
        { error: "Narration text must contain characters" },
        { status: 400 },
      );
    }

    const voiceResult = await adapter.synthesizeVoice({
      text: sanitizedText,
      ssml: adapter.vendor === "elevenlabs" ? ssmlInput : undefined,
      voiceId: typeof voiceId === "string" ? voiceId : undefined,
      emotion: typeof emotion === "string" ? emotion : undefined,
      speed: typeof speed === "number" ? speed : undefined,
      pitch: typeof pitch === "number" ? pitch : undefined,
      outputFormat: typeof outputFormat === "string" ? outputFormat : undefined,
    });

    const convex = await getConvexClient();

    await convex.mutation(api.video.updateSceneNarration, {
      sceneId: sceneId as Id<"scenes">,
      narrationUrl: voiceResult.audioUrl,
      narrationText: sanitizedText,
      voiceId: voiceResult.voiceId,
      voiceName: voiceResult.voiceName,
    });

    return NextResponse.json({
      success: true,
      provider: adapter.vendor,
      modelKey: adapter.providerKey,
      audioUrl: voiceResult.audioUrl,
      format: voiceResult.format,
      durationSeconds: voiceResult.durationSeconds,
      truncated,
      narrationText: sanitizedText,
    });
  } catch (error) {
    console.error("Failed to generate scene narration:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate narration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
