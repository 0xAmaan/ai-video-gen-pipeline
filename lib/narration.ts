import Replicate from "replicate";
import {
  MINIMAX_VOICE_IDS,
  MINIMAX_EMOTIONS,
  MINIMAX_VOICES,
  type MiniMaxEmotion,
  type MiniMaxVoiceId,
} from "./voice-selection";
import { extractReplicateUrl } from "./replicate";

export const MAX_NARRATION_CHARACTERS = 10000;

let replicateClient: Replicate | null = null;
const getReplicateClient = () => {
  if (!replicateClient) {
    if (!process.env.REPLICATE_API_KEY) {
      throw new Error(
        "REPLICATE_API_KEY is not configured. Cannot synthesize narration.",
      );
    }
    replicateClient = new Replicate({
      auth: process.env.REPLICATE_API_KEY,
    });
  }
  return replicateClient;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const isValidVoiceId = (
  voiceId: string,
): voiceId is MiniMaxVoiceId =>
  (MINIMAX_VOICE_IDS as readonly string[]).includes(voiceId);

export const isValidEmotion = (
  value: string,
): value is MiniMaxEmotion =>
  (MINIMAX_EMOTIONS as readonly string[]).includes(value as MiniMaxEmotion);

export const sanitizeNarrationText = (raw: string) => {
  const trimmed = raw.trim();
  const text =
    trimmed.length > MAX_NARRATION_CHARACTERS
      ? trimmed.slice(0, MAX_NARRATION_CHARACTERS)
      : trimmed;
  return {
    text,
    truncated: trimmed.length > MAX_NARRATION_CHARACTERS,
  };
};

export interface VoiceSettingsInput {
  voiceId: string;
  emotion?: string;
  speed?: number;
  pitch?: number;
}

export const normalizeVoiceSettings = ({
  voiceId,
  emotion,
  speed = 1,
  pitch = 0,
}: VoiceSettingsInput) => {
  const validVoiceId = isValidVoiceId(voiceId) ? voiceId : "Wise_Woman";
  const validEmotion = emotion && isValidEmotion(emotion) ? emotion : "auto";

  return {
    voiceId: validVoiceId,
    voiceName: MINIMAX_VOICES[validVoiceId].name,
    emotion: validEmotion as MiniMaxEmotion,
    speed: clamp(Number(speed) || 1, 0.5, 2),
    pitch: Math.round(clamp(Number(pitch) || 0, -12, 12)), // Must be integer
  };
};

export interface NarrationSynthesisParams extends VoiceSettingsInput {
  text: string;
}

export interface NarrationSynthesisResult {
  audioUrl: string;
  sanitizedText: string;
  truncated: boolean;
  voiceId: MiniMaxVoiceId;
  voiceName: string;
  emotion: MiniMaxEmotion;
  speed: number;
  pitch: number;
}

export async function synthesizeNarrationAudio({
  text,
  voiceId,
  emotion,
  speed,
  pitch,
}: NarrationSynthesisParams): Promise<NarrationSynthesisResult> {
  const { text: safeText, truncated } = sanitizeNarrationText(text);
  if (!safeText) {
    throw new Error("Narration text must contain characters.");
  }

  const normalized = normalizeVoiceSettings({
    voiceId,
    emotion,
    speed,
    pitch,
  });

  const output = await getReplicateClient().run("minimax/speech-02-hd", {
    input: {
      text: safeText,
      voice_id: normalized.voiceId,
      emotion: normalized.emotion,
      speed: normalized.speed,
      pitch: normalized.pitch,
      sample_rate: 44100, // MiniMax only supports: 8000, 16000, 22050, 24000, 32000, 44100
      audio_format: "wav", // Required for Sync Labs lipsync compatibility
      bitrate: 128000,
      channel: "mono",
    },
  });

  const audioUrl = extractReplicateUrl(
    output,
    `narration (${normalized.voiceId})`,
  );

  return {
    audioUrl,
    sanitizedText: safeText,
    truncated,
    voiceId: normalized.voiceId,
    voiceName: normalized.voiceName,
    emotion: normalized.emotion,
    speed: normalized.speed,
    pitch: normalized.pitch,
  };
}
