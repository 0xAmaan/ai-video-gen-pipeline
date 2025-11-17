import { AUDIO_MODELS, type AudioVendor } from "@/lib/audio-models";
import { sanitizeNarrationText } from "@/lib/narration";
import { getVoiceAdapter } from "@/lib/audio-provider-factory";
import { apiResponse, apiError } from "@/lib/api-response";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";

const isAudioVendor = (value: unknown): value is AudioVendor =>
  typeof value === "string" &&
  ["replicate", "elevenlabs", "freesound", "local"].includes(value);

const isAudioModelKey = (value: unknown): value is keyof typeof AUDIO_MODELS =>
  typeof value === "string" && value in AUDIO_MODELS;

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
      voiceProvider,
      voiceModelKey,
    } = await req.json();

    flowTracker.trackAPICall("POST", "/api/preview-voice", {
      voiceProvider,
      voiceModelKey,
      demoMode,
    });

    const adapter = getVoiceAdapter({
      vendor: isAudioVendor(voiceProvider) ? voiceProvider : undefined,
      modelKey: isAudioModelKey(voiceModelKey) ? voiceModelKey : undefined,
    });

    flowTracker.trackDecision(
      "Select voice provider",
      adapter.vendor,
      `Using ${adapter.vendor} for voice preview`,
    );

    const fallbackPrompt = `This is a preview of the ${adapter.providerKey} voice.`;
    const rawText =
      typeof text === "string" && text.trim().length > 0
        ? text.trim()
        : fallbackPrompt;
    const { text: sanitizedText } = sanitizeNarrationText(rawText);

    const narration = await adapter.synthesizeVoice({
      text: sanitizedText,
      voiceId: typeof voiceId === "string" ? voiceId : undefined,
      emotion: typeof emotion === "string" ? emotion : undefined,
      speed: typeof speed === "number" ? speed : undefined,
      pitch: typeof pitch === "number" ? pitch : undefined,
    });

    return apiResponse({
      success: true,
      provider: adapter.vendor,
      modelKey: adapter.providerKey,
      audioUrl: narration.audioUrl,
      narrationText: sanitizedText,
      voiceId: narration.voiceId,
      voiceName: narration.voiceName,
    });
  } catch (error) {
    console.error("Failed to preview voice:", error);
    return apiError(
      "Failed to preview voice",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
