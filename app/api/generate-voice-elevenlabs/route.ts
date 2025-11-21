"use server";

import { NextResponse } from "next/server";
import {
  AUDIO_MODELS,
  type AudioVendor,
} from "@/lib/audio-models";
import { getVoiceAdapter } from "@/lib/audio-provider-factory";

const isAudioModelKey = (
  value: unknown,
): value is keyof typeof AUDIO_MODELS =>
  typeof value === "string" && value in AUDIO_MODELS;

const ELEVENLABS_VENDOR: AudioVendor = "elevenlabs";

export async function POST(req: Request) {
  try {
    const {
      text,
      ssml,
      voiceId,
      emotion,
      speed,
      pitch,
      outputFormat,
      modelKey,
    } = await req.json();

    const hasText = typeof text === "string" && text.trim().length > 0;
    const hasSsml = typeof ssml === "string" && ssml.trim().length > 0;
    if (!hasText && !hasSsml) {
      return NextResponse.json(
        { error: "text or ssml is required" },
        { status: 400 },
      );
    }

    const adapter = getVoiceAdapter({
      vendor: ELEVENLABS_VENDOR,
      modelKey: isAudioModelKey(modelKey) ? modelKey : undefined,
    });

    const result = await adapter.synthesizeVoice({
      text: hasText ? text.trim() : "",
      ssml: hasSsml ? ssml : undefined,
      voiceId: typeof voiceId === "string" ? voiceId : undefined,
      emotion: typeof emotion === "string" ? emotion : undefined,
      speed: typeof speed === "number" ? speed : undefined,
      pitch: typeof pitch === "number" ? pitch : undefined,
      outputFormat: typeof outputFormat === "string" ? outputFormat : undefined,
    });

    return NextResponse.json({
      success: true,
      modelKey: adapter.providerKey,
      audioUrl: result.audioUrl,
      format: result.format,
      durationSeconds: result.durationSeconds,
      voiceId: result.voiceId,
      voiceName: result.voiceName,
    });
  } catch (error) {
    console.error("generate-voice-elevenlabs error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate voice via ElevenLabs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
