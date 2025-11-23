"use server";

import { NextResponse } from "next/server";
import {
  AUDIO_MODELS,
  type AudioVendor,
} from "@/lib/audio-models";
import { getVoiceAdapter } from "@/lib/audio-provider-factory";

/**
 * Type guard to check if a value is a valid audio model key
 * @param value - Value to check
 * @returns True if value is a key in AUDIO_MODELS
 */
const isAudioModelKey = (
  value: unknown,
): value is keyof typeof AUDIO_MODELS =>
  typeof value === "string" && value in AUDIO_MODELS;

/**
 * Type guard to check if a value is a valid audio vendor
 * @param value - Value to check
 * @returns True if value is a supported vendor
 */
const isAudioVendor = (value: unknown): value is AudioVendor =>
  typeof value === "string" &&
  ["replicate", "elevenlabs", "freesound", "local"].includes(value);

/**
 * API endpoint for voice generation in the video editor
 *
 * Generates AI voice audio from text input using either Replicate (MiniMax/Bark)
 * or ElevenLabs providers. Returns base64-encoded audio that can be added to the timeline.
 *
 * @route POST /api/generate-voice-editor
 *
 * @param req.body.text - Text to convert to speech
 * @param req.body.ssml - Optional SSML markup (ElevenLabs only)
 * @param req.body.voiceId - Voice identifier (MiniMax voice ID or ElevenLabs voice ID)
 * @param req.body.emotion - Emotion/style (auto, happy, sad, angry, etc.)
 * @param req.body.speed - Speech speed multiplier (0.5-2.0)
 * @param req.body.pitch - Pitch adjustment (-12 to +12 semitones)
 * @param req.body.modelKey - Audio model key (e.g., "replicate-minimax-turbo")
 * @param req.body.vendor - Provider vendor ("replicate" or "elevenlabs")
 *
 * @returns {success: true, audioUrl: string, format: string, durationSeconds: number} on success
 * @returns {success: false, error: string, details: string} on failure
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/generate-voice-editor', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     text: 'Hello world',
 *     voiceId: 'Wise_Woman',
 *     emotion: 'auto',
 *     speed: 1.0,
 *     pitch: 0,
 *     modelKey: 'replicate-minimax-turbo',
 *     vendor: 'replicate'
 *   })
 * });
 * ```
 */
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
      vendor,
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
      vendor: isAudioVendor(vendor) ? vendor : undefined,
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
      vendor: adapter.vendor,
      modelKey: adapter.providerKey,
      audioUrl: result.audioUrl,
      format: result.format,
      durationSeconds: result.durationSeconds,
      voiceId: result.voiceId,
      voiceName: result.voiceName,
    });
  } catch (error) {
    console.error("generate-voice-editor error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate voice",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
