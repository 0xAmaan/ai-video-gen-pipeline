"use server";

import { apiResponse, apiError } from "@/lib/api-response";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";
import { mockElevenLabsVoices, mockDelay } from "@/lib/demo-mocks/music";

const API_BASE =
  process.env.ELEVENLABS_API_BASE_URL ?? "https://api.elevenlabs.io/v1";

export async function GET(req: Request) {
  const flowTracker = getFlowTracker();
  const demoMode = getDemoModeFromHeaders(req.headers);

  try {
    flowTracker.trackAPICall("GET", "/api/list-elevenlabs-voices", {
      demoMode,
    });

    // Demo mode check
    if (demoMode === "no-cost") {
      flowTracker.trackDecision(
        "Check demo mode",
        "no-cost",
        "Using mock ElevenLabs voices",
      );
      await mockDelay(300);
      const mockVoices = mockElevenLabsVoices();
      return apiResponse({ voices: mockVoices });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      flowTracker.trackDecision(
        "Check ElevenLabs API key",
        "missing",
        "ELEVENLABS_API_KEY not configured",
      );
      return apiResponse({
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
      return apiError(
        errorText || "Failed to load ElevenLabs voices.",
        response.status,
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

    flowTracker.trackDecision(
      "Fetch ElevenLabs voices",
      "success",
      `Fetched ${voices.length} voices`,
    );

    return apiResponse({ voices });
  } catch (error) {
    console.error("list-elevenlabs-voices error:", error);
    return apiError(
      "Failed to fetch ElevenLabs voices.",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
