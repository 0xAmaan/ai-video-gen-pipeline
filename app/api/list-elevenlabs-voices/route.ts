"use server";

import { NextResponse } from "next/server";

const API_BASE =
  process.env.ELEVENLABS_API_BASE_URL ?? "https://api.elevenlabs.io/v1";

export async function GET() {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        voices: [],
        error: "ELEVENLABS_API_KEY not configured.",
      });
    }

    const response = await fetch(`${API_BASE}/voices`, {
      headers: {
        "xi-api-key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          voices: [],
          error: errorText || "Failed to load ElevenLabs voices.",
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    const voices =
      data.voices?.map((voice: any) => ({
        id: voice.voice_id ?? voice.id,
        name: voice.name,
        previewUrl: voice.preview_url,
        labels: voice.labels,
      })) ?? [];

    return NextResponse.json({ voices });
  } catch (error) {
    console.error("list-elevenlabs-voices error:", error);
    return NextResponse.json(
      { voices: [], error: "Failed to fetch ElevenLabs voices." },
      { status: 500 },
    );
  }
}
