"use server";

import { NextResponse } from "next/server";
import {
  AUDIO_MODELS,
  type AudioVendor,
} from "@/lib/audio-models";
import { getSoundLibraryAdapter } from "@/lib/audio-provider-factory";

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
      query,
      category,
      mood,
      durationRange,
      page,
      perPage,
      modelKey,
      provider,
    } = await req.json();

    if (typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "query is required" },
        { status: 400 },
      );
    }

    const adapter = getSoundLibraryAdapter({
      modelKey: isAudioModelKey(modelKey) ? modelKey : undefined,
      vendor: isAudioVendor(provider) ? provider : undefined,
    });

    const results = await adapter.searchLibrary({
      query: query.trim(),
      category: typeof category === "string" ? category : undefined,
      mood: typeof mood === "string" ? mood : undefined,
      durationRange: Array.isArray(durationRange) && durationRange.length === 2
        ? [
            Number(durationRange[0]) || 0,
            Number(durationRange[1]) || 0,
          ]
        : undefined,
      page: typeof page === "number" ? page : undefined,
      perPage: typeof perPage === "number" ? perPage : undefined,
    });

    return NextResponse.json({
      success: true,
      modelKey: adapter.providerKey,
      results,
    });
  } catch (error) {
    console.error("search-audio error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to search audio",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
