import { NextResponse } from "next/server";
import {
  AUDIO_MODELS,
  type AudioVendor,
} from "@/lib/audio-models";
import { sanitizeNarrationText } from "@/lib/narration";
import { getVoiceAdapter } from "@/lib/audio-provider-factory";

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
      voiceId,
      emotion = "auto",
      speed = 1,
      pitch = 0,
      text,
      voiceProvider,
      voiceModelKey,
    } = await req.json();

    const adapter = getVoiceAdapter({
      vendor: isAudioVendor(voiceProvider) ? voiceProvider : undefined,
      modelKey: isAudioModelKey(voiceModelKey) ? voiceModelKey : undefined,
    });

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

    return NextResponse.json({
      success: true,
      modelKey: adapter.providerKey,
      audioUrl: narration.audioUrl,
      narrationText: sanitizedText,
      voiceId: narration.voiceId,
      voiceName: narration.voiceName,
    });
  } catch (error) {
    console.error("Failed to preview voice:", error);
    return NextResponse.json(
      { success: false, error: "Failed to preview voice" },
      { status: 500 },
    );
  }
}
