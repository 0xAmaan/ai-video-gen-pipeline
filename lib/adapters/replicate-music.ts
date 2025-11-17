import Replicate from "replicate";
import {
  AUDIO_MODELS,
  DEFAULT_MUSIC_MODEL,
  getAudioModel,
  type AudioModel,
  type AudioTrackResult,
  type MusicGenerationAdapter,
  type MusicGenerationRequest,
} from "@/lib/audio-models";
import { extractReplicateUrl } from "@/lib/replicate";

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not configured`);
  }
  return value;
};

const clampDuration = (
  requested: number | undefined,
  maxDuration?: number,
) => {
  const safe = Math.max(1, Math.round(requested ?? 30));
  if (typeof maxDuration === "number") {
    return Math.min(safe, maxDuration);
  }
  return safe;
};

const getDefaultDuration = (model: AudioModel) => {
  const value = model.defaultParams?.duration;
  return typeof value === "number" ? value : undefined;
};

/**
 * Generic Replicate adapter for MusicGen / Riffusion style models.
 */
export class ReplicateMusicAdapter implements MusicGenerationAdapter {
  providerKey: keyof typeof AUDIO_MODELS;
  vendor = "replicate" as const;
  kind = "music_generation" as const;

  private readonly client: Replicate;

  constructor(
    providerKey: keyof typeof AUDIO_MODELS = DEFAULT_MUSIC_MODEL,
  ) {
    const config = getAudioModel(providerKey);
    if (config.vendor !== "replicate" || config.kind !== "music_generation") {
      throw new Error(
        `ReplicateMusicAdapter requires a Replicate music model, received ${config.name}`,
      );
    }

    this.providerKey = providerKey;
    this.client = new Replicate({
      auth: getRequiredEnv("REPLICATE_API_KEY"),
    });
  }

  private get config(): AudioModel {
    return getAudioModel(this.providerKey);
  }

  private isLyriaModel(model: AudioModel): boolean {
    return /lyria/i.test(model.id) || /lyria/i.test(this.providerKey);
  }

  private isBarkModel(model: AudioModel): boolean {
    return /bark/i.test(model.id) || /bark/i.test(this.providerKey);
  }

  async generateTrack(
    request: MusicGenerationRequest,
  ): Promise<AudioTrackResult> {
    const config = this.config;
    const isLyria = this.isLyriaModel(config);
    const isBark = this.isBarkModel(config);

    let durationSeconds = clampDuration(
      request.durationSeconds ?? getDefaultDuration(config),
      config.maxDurationSeconds,
    );

    let input: Record<string, unknown>;

    if (isLyria) {
      durationSeconds = config.maxDurationSeconds ?? 30;
      const defaultNegative =
        typeof config.defaultParams?.negative_prompt === "string"
          ? (config.defaultParams?.negative_prompt as string)
          : "";
      const defaultSeed =
        typeof config.defaultParams?.seed === "number"
          ? (config.defaultParams?.seed as number)
          : undefined;

      input = {
        prompt: request.prompt,
      };

      const negativePrompt = request.negativePrompt ?? defaultNegative;
      if (negativePrompt) {
        input.negative_prompt = negativePrompt;
      }
      const seed =
        typeof request.seed === "number" ? request.seed : defaultSeed;
      if (typeof seed === "number" && Number.isFinite(seed)) {
        input.seed = seed;
      }
    } else if (isBark) {
      durationSeconds = config.maxDurationSeconds ?? durationSeconds;
      const historyPrompt =
        typeof request.historyPrompt === "string"
          ? request.historyPrompt
          : (config.defaultParams?.history_prompt as string | null) ?? null;
      const textTemp =
        typeof request.textTemperature === "number"
          ? request.textTemperature
          : (config.defaultParams?.text_temp as number) ?? 0.7;
      const waveformTemp =
        typeof request.waveformTemperature === "number"
          ? request.waveformTemperature
          : (config.defaultParams?.waveform_temp as number) ?? 0.7;

      input = {
        prompt: request.prompt,
        history_prompt: historyPrompt,
        text_temp: textTemp,
        waveform_temp: waveformTemp,
      };
    } else {
      input = {
        prompt: request.prompt,
        duration: durationSeconds,
        ...(config.defaultParams ?? {}),
      };

      if (request.referenceAudioUrl) {
        input.audio = request.referenceAudioUrl;
        input.audio_start_at = 0;
      }
      if (request.style) {
        input.style = request.style;
      }
      if (request.tempo) {
        input.tempo = request.tempo;
      }

      if (
        typeof input.prompt_b === "undefined" &&
        typeof input.prompt_a === "undefined" &&
        /riffusion/i.test(config.id)
      ) {
        input.prompt_a = request.prompt;
        input.prompt_b = request.prompt;
      }
    }

    const output = await this.client.run(
      config.id as `${string}/${string}`,
      {
        input,
      },
    );

    const audioUrl = extractReplicateUrl(output, config.name);

    return {
      audioUrl,
      format: config.outputFormats?.[0] ?? "wav",
      durationSeconds,
      metadata: {
        provider: config.name,
        request: {
          ...input,
          duration: durationSeconds,
        },
      },
    };
  }
}
