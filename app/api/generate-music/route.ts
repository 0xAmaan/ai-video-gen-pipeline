"use server";

import { NextResponse } from "next/server";
import {
  AUDIO_MODELS,
  type AudioVendor,
} from "@/lib/audio-models";
import { getMusicAdapter } from "@/lib/audio-provider-factory";

const isAudioVendor = (value: unknown): value is AudioVendor =>
  typeof value === "string" &&
  ["replicate", "elevenlabs", "freesound", "local"].includes(value);

const isAudioModelKey = (
  value: unknown,
): value is keyof typeof AUDIO_MODELS =>
  typeof value === "string" && value in AUDIO_MODELS;

export async function POST(req: Request) {
  try {
    const {
      prompt,
      durationSeconds,
      referenceAudioUrl,
      style,
      tempo,
      modelKey,
      provider,
    } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 },
      );
    }

    const adapter = getMusicAdapter({
      modelKey: isAudioModelKey(modelKey) ? modelKey : undefined,
      vendor: isAudioVendor(provider) ? provider : undefined,
    });

    const track = await adapter.generateTrack({
      prompt: prompt.trim(),
      durationSeconds:
        typeof durationSeconds === "number" ? durationSeconds : undefined,
      referenceAudioUrl:
        typeof referenceAudioUrl === "string" ? referenceAudioUrl : undefined,
      style: typeof style === "string" ? style : undefined,
      tempo: typeof tempo === "string" ? tempo : undefined,
    });

    return NextResponse.json({
      success: true,
      modelKey: adapter.providerKey,
      track,
    });
  } catch (error) {
    console.error("generate-music error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate music",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
