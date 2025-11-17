import { Buffer } from "node:buffer";
import {
  AUDIO_MODELS,
  DEFAULT_VOICE_MODEL,
  getAudioModel,
  type VoiceSynthesisAdapter,
  type VoiceSynthesisRequest,
  type VoiceSynthesisResult,
} from "@/lib/audio-models";

const API_BASE =
  process.env.ELEVENLABS_API_BASE_URL ?? "https://api.elevenlabs.io/v1";

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not configured`);
  }
  return value;
};

const estimateSpeechDuration = (text: string) => {
  const words = text.trim().split(/\s+/).length;
  const wordsPerSecond = 2.6;
  return Math.max(1, Math.round(words / wordsPerSecond));
};

const numericDefaultParam = (
  configKey: keyof typeof AUDIO_MODELS,
  param: string,
  fallback: number,
) => {
  const model = getAudioModel(configKey);
  const raw = model.defaultParams?.[param];
  return typeof raw === "number" ? (raw as number) : fallback;
};

const emotionToStyle = (emotion?: string) => {
  if (!emotion) return undefined;
  const normalized = emotion.toLowerCase();
  switch (normalized) {
    case "happy":
    case "excited":
    case "surprised":
      return 0.75;
    case "sad":
    case "calm":
      return 0.2;
    case "angry":
      return 0.6;
    default:
      return undefined;
  }
};

type ElevenLabsVoiceAdapterOptions = {
  providerKey?: keyof typeof AUDIO_MODELS;
  defaultVoiceId?: string;
};

export class ElevenLabsVoiceAdapter implements VoiceSynthesisAdapter {
  providerKey: keyof typeof AUDIO_MODELS;
  vendor = "elevenlabs" as const;
  kind = "voice_synthesis" as const;

  private readonly apiKey: string;
  private readonly defaultVoiceId?: string;

  constructor(options: ElevenLabsVoiceAdapterOptions = {}) {
    const providerKey = options.providerKey ?? DEFAULT_VOICE_MODEL;
    const config = getAudioModel(providerKey);
    if (config.vendor !== "elevenlabs" || config.kind !== "voice_synthesis") {
      throw new Error("ElevenLabsVoiceAdapter requires an ElevenLabs model.");
    }

    this.providerKey = providerKey;
    this.apiKey = getRequiredEnv("ELEVENLABS_API_KEY");
    this.defaultVoiceId =
      options.defaultVoiceId ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID;
  }

  private get config() {
    return getAudioModel(this.providerKey);
  }

  async synthesizeVoice(
    request: VoiceSynthesisRequest,
  ): Promise<VoiceSynthesisResult> {
    const text = (request.ssml ?? request.text ?? "").trim();
    if (!text) {
      throw new Error("Voice synthesis text/SSML is required.");
    }

    const voiceId = request.voiceId ?? this.defaultVoiceId;
    if (!voiceId) {
      throw new Error(
        "ElevenLabs voiceId is required (pass in request or configure ELEVENLABS_DEFAULT_VOICE_ID).",
      );
    }

    const config = this.config;
    const outputFormat =
      request.outputFormat === "wav" ? "pcm_44100" : "mp3_44100_128";
    const acceptHeader =
      request.outputFormat === "wav" ? "audio/wav" : "audio/mpeg";

    const stability = numericDefaultParam(
      this.providerKey,
      "stability",
      0.35,
    );
    const similarity = numericDefaultParam(
      this.providerKey,
      "similarity_boost",
      0.75,
    );

    const payload: Record<string, unknown> = {
      text,
      model_id: config.id,
      output_format: outputFormat,
      voice_settings: {
        stability,
        similarity_boost: similarity,
        style: emotionToStyle(request.emotion),
        use_speaker_boost: true,
      },
      ...("optimize_streaming_latency" in (config.defaultParams ?? {})
        ? { optimize_streaming_latency: config.defaultParams?.optimize_streaming_latency }
        : {}),
    };

    const response = await fetch(
      `${API_BASE}/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
          Accept: acceptHeader,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ElevenLabs TTS failed (${response.status}): ${errorText}`,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const mime = acceptHeader;
    const audioUrl = `data:${mime};base64,${buffer.toString("base64")}`;

    return {
      audioUrl,
      format: request.outputFormat === "wav" ? "wav" : "mp3",
      durationSeconds: estimateSpeechDuration(text),
      voiceId,
      voiceName: voiceId,
      metadata: {
        provider: config.name,
        outputFormat,
      },
    };
  }
}
