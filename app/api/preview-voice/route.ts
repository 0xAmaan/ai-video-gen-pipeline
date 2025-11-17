import { synthesizeNarrationAudio } from "@/lib/narration";
import {
  MINIMAX_VOICE_IDS,
  MINIMAX_VOICES,
  type MiniMaxVoiceId,
} from "@/lib/voice-selection";
import { apiResponse, apiError } from "@/lib/api-response";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";
import { mockNarrationSynthesis, mockDelay } from "@/lib/demo-mocks";

const isSupportedVoiceId = (id: string): id is MiniMaxVoiceId =>
  (MINIMAX_VOICE_IDS as readonly string[]).includes(id);

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  const demoMode = getDemoModeFromHeaders(req.headers);

  try {
    const {
      voiceId,
      emotion = "auto",
      speed = 1,
      pitch = 0,
      text,
    } = await req.json();

    flowTracker.trackAPICall("POST", "/api/preview-voice", {
      voiceId,
      demoMode,
    });

    if (!voiceId || typeof voiceId !== "string") {
      return apiError("voiceId is required", 400);
    }

    const resolvedVoiceId = isSupportedVoiceId(voiceId)
      ? voiceId
      : "Wise_Woman";
    const voice = MINIMAX_VOICES[resolvedVoiceId];

    const previewText =
      typeof text === "string" && text.trim().length > 0
        ? text
        : `This is ${voice.name}, demonstrating the narration tone you selected.`;

    // Demo mode: Return mock voice preview instantly
    if (demoMode === "no-cost") {
      flowTracker.trackDecision(
        "Check demo mode",
        "no-cost",
        "Using mock voice preview - zero API costs",
      );
      await mockDelay(300);
      const mockNarration = mockNarrationSynthesis();
      return apiResponse({
        success: true,
        audioUrl: mockNarration.audio_url,
        narrationText: previewText,
      });
    }

    const narration = await synthesizeNarrationAudio({
      text: previewText,
      voiceId: resolvedVoiceId,
      emotion,
      speed,
      pitch,
    });

    return apiResponse({
      success: true,
      audioUrl: narration.audioUrl,
      narrationText: narration.sanitizedText,
    });
  } catch (error) {
    console.error("Failed to preview voice:", error);
    return apiError("Failed to preview voice", 500);
  }
}
