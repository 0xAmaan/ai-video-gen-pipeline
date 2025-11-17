import Replicate from "replicate";
import {
  AUDIO_MODELS,
  getAudioModel,
  type VoiceSynthesisAdapter,
  type VoiceSynthesisRequest,
  type VoiceSynthesisResult,
} from "@/lib/audio-models";
import {
  sanitizeNarrationText,
  normalizeVoiceSettings,
  isValidVoiceId,
} from "@/lib/narration";
import { extractReplicateUrl } from "@/lib/replicate";

const DEFAULT_MODEL_KEY = "replicate-minimax-tts" as const;

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not configured`);
  }
  return value;
};

const stripSSML = (value: string) => value.replace(/<[^>]+>/g, " ");

const estimateSpeechDuration = (text: string) => {
  const words = text.trim().split(/\s+/).length;
  const wordsPerSecond = 2.5; // ~150 wpm
  return Math.max(1, Math.round(words / wordsPerSecond));
};

export class ReplicateVoiceAdapter implements VoiceSynthesisAdapter {
  providerKey: keyof typeof AUDIO_MODELS;
  vendor = "replicate" as const;
  kind = "voice_synthesis" as const;

  private readonly client: Replicate;

  constructor(
    providerKey: keyof typeof AUDIO_MODELS = DEFAULT_MODEL_KEY,
  ) {
    const config = getAudioModel(providerKey);
    if (config.vendor !== "replicate" || config.kind !== "voice_synthesis") {
      throw new Error("ReplicateVoiceAdapter requires a Replicate voice model");
    }

    this.providerKey = providerKey;
    this.client = new Replicate({
      auth: getRequiredEnv("REPLICATE_API_KEY"),
    });
  }

  async synthesizeVoice(
    request: VoiceSynthesisRequest,
  ): Promise<VoiceSynthesisResult> {
    const rawText = request.ssml
      ? stripSSML(request.ssml)
      : request.text ?? "";
    const { text, truncated } = sanitizeNarrationText(rawText);
    if (!text) {
      throw new Error("Voice synthesis text must not be empty.");
    }

    const requestedVoiceId =
      typeof request.voiceId === "string" && request.voiceId.length > 0
        ? request.voiceId
        : "Wise_Woman";
    const normalized = normalizeVoiceSettings({
      voiceId: isValidVoiceId(requestedVoiceId)
        ? requestedVoiceId
        : "Wise_Woman",
      emotion: request.emotion,
      speed: request.speed,
      pitch: request.pitch,
    });

    const model = getAudioModel(this.providerKey);
    const output = await this.client.run(model.id as `${string}/${string}`, {
      input: {
        text,
        voice_id: normalized.voiceId,
        emotion: normalized.emotion,
        speed: normalized.speed,
        pitch: normalized.pitch,
        ...(model.defaultParams ?? {}),
      },
    });

    const audioUrl = extractReplicateUrl(output, model.name);

    return {
      audioUrl,
      format: model.outputFormats?.[0] ?? "wav",
      durationSeconds: estimateSpeechDuration(text),
      voiceId: normalized.voiceId,
      voiceName: normalized.voiceName,
      metadata: {
        truncated,
        emotion: normalized.emotion,
      },
    };
  }
}
