import { NextResponse } from "next/server";
import { synthesizeNarrationAudio } from "@/lib/narration";
import {
  MINIMAX_VOICE_IDS,
  MINIMAX_VOICES,
  type MiniMaxVoiceId,
} from "@/lib/voice-selection";

const isSupportedVoiceId = (id: string): id is MiniMaxVoiceId =>
  (MINIMAX_VOICE_IDS as readonly string[]).includes(id);

export async function POST(req: Request) {
  try {
    const { voiceId, emotion = "auto", speed = 1, pitch = 0, text } =
      await req.json();

    if (!voiceId || typeof voiceId !== "string") {
      return NextResponse.json(
        { error: "voiceId is required" },
        { status: 400 },
      );
    }

    const resolvedVoiceId = isSupportedVoiceId(voiceId)
      ? voiceId
      : "Wise_Woman";
    const voice = MINIMAX_VOICES[resolvedVoiceId];

    const narration = await synthesizeNarrationAudio({
      text:
        typeof text === "string" && text.trim().length > 0
          ? text
          : `This is ${voice.name}, demonstrating the narration tone you selected.`,
      voiceId: resolvedVoiceId,
      emotion,
      speed,
      pitch,
    });

    return NextResponse.json({
      success: true,
      audioUrl: narration.audioUrl,
      narrationText: narration.sanitizedText,
    });
  } catch (error) {
    console.error("Failed to preview voice:", error);
    return NextResponse.json(
      { success: false, error: "Failed to preview voice" },
      { status: 500 },
    );
  }
}
