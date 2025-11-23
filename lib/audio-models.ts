/**
 * Audio model registry & provider abstractions
 * Mirrors the structure of lib/image-models.ts so new services can be wired in consistently.
 */

export type AudioModelKind =
  | "music_generation"
  | "voice_synthesis"
  | "sound_library";

export type AudioVendor = "replicate" | "elevenlabs" | "freesound" | "local";

export type AudioCapability =
  | "music-generation"
  | "stem-output"
  | "prompt-audio"
  | "text_to_audio"
  | "negative_prompt"
  | "high_fidelity"
  | "voice-cloning"
  | "ssml"
  | "emotion-control"
  | "sound-effects"
  | "stock-library";

export interface AudioModel {
  /** Identifier used by the upstream provider (model slug, endpoint, etc.). */
  id: string;
  /** Human readable model name. */
  name: string;
  /** High-level category for routing. */
  kind: AudioModelKind;
  /** Upstream vendor handling the request. */
  vendor: AudioVendor;
  /** Capabilities supported by this integration. */
  capabilities: AudioCapability[];
  /** Common scenarios where this provider excels. */
  bestFor: string[];
  /** Estimated cost per generation (USD). */
  estimatedCost?: number;
  /** Pricing unit description (per minute, per track, per request). */
  costUnit?: string;
  /** Typical generation latency in seconds. */
  latencySeconds?: number;
  /** Maximum supported duration (seconds) when applicable. */
  maxDurationSeconds?: number;
  /** Supported output formats/extensions. */
  outputFormats?: string[];
  /** Default parameters passed to the provider. */
  defaultParams?: Record<string, unknown>;
  /** Additional implementation details or warnings. */
  notes?: string;
  /** Documentation or dashboard link for quick reference. */
  docsUrl?: string;
}

const withEnvOverride = (
  value: string | undefined,
  fallback: string,
) =>
  value && value.trim().length > 0 ? value.trim() : fallback;

const MUSICGEN_DEFAULT_MODEL =
  "meta/musicgen:b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38";
const LYRIA2_DEFAULT_MODEL = "google/lyria-2";
const RIFFUSION_DEFAULT_MODEL =
  "riffusion/riffusion:8cf61ea6c56afd61d8f5b9ffd14d7c216c0a93844ce2d82ac1c9ecc9c7f24e05";
const BARK_DEFAULT_MODEL =
  "suno-ai/bark:b76242b40d67c76ab6742e987628a2a9ac019e11d56ab96c4e91ce03b79b2787";
const MINIMAX_SPEECH_DEFAULT_MODEL =
  "minimax/speech-02-hd:fdd081f807e655246ef42adbcb3ee9334e7fdc710428684771f90d69992cabb3";
const MINIMAX_SPEECH_TURBO_MODEL =
  "minimax/speech-02-turbo:e9f9a5c7f0f2e0f9f5c7f0f2e0f9f5c7f0f2e0f9f5c7f0f2e0f9f5c7f0f2e0f9";

export const AUDIO_MODELS: Record<string, AudioModel> = {
  // --- Music generation (Replicate) ---
  "lyria-2": {
    id: withEnvOverride(
      process.env.REPLICATE_LYRIA2_MODEL,
      LYRIA2_DEFAULT_MODEL,
    ),
    name: "Google Lyria 2",
    kind: "music_generation",
    vendor: "replicate",
    capabilities: [
      "music-generation",
      "prompt-audio",
      "text_to_audio",
      "negative_prompt",
      "high_fidelity",
    ],
    bestFor: [
      "high-fidelity underscores",
      "premium product launches",
      "music cues that require negative prompt control",
    ],
    estimatedCost: 0.0001,
    costUnit: "per_second_output",
    latencySeconds: 10,
    maxDurationSeconds: 30,
    outputFormats: ["wav"],
    defaultParams: {
      prompt: "",
      negative_prompt: "",
      seed: undefined,
    },
    notes:
      "48kHz stereo output with SynthID watermarking. Best choice for polished background cues.",
    docsUrl: "https://replicate.com/google/lyria-2",
  },
  "musicgen-large": {
    id: withEnvOverride(
      process.env.REPLICATE_MUSICGEN_MODEL ??
        process.env.REPLICATE_MUSICGEN_MODEL_ID,
      MUSICGEN_DEFAULT_MODEL,
    ),
    name: "MusicGen Large",
    kind: "music_generation",
    vendor: "replicate",
    capabilities: ["music-generation", "prompt-audio"],
    bestFor: [
      "cinematic underscore",
      "ad jingles",
      "custom background loops",
    ],
    estimatedCost: 0.12,
    costUnit: "per 20s clip",
    latencySeconds: 15,
    maxDurationSeconds: 120,
    outputFormats: ["wav", "mp3"],
    defaultParams: {
      duration: 30,
      top_k: 250,
      top_p: 0,
      temperature: 1,
      cfg_scale: 7,
    },
    notes:
      "Meta MusicGen large checkpoint via Replicate. Supports text prompts + optional audio conditioning.",
    docsUrl: "https://replicate.com/meta/musicgen",
  },
  "riffusion-v1": {
    id: withEnvOverride(
      process.env.REPLICATE_RIFFUSION_MODEL,
      RIFFUSION_DEFAULT_MODEL,
    ),
    name: "Riffusion v1",
    kind: "music_generation",
    vendor: "replicate",
    capabilities: ["music-generation"],
    bestFor: ["loop-based tracks", "genre exploration", "ambient textures"],
    estimatedCost: 0.04,
    costUnit: "per loop",
    latencySeconds: 8,
    maxDurationSeconds: 10,
    outputFormats: ["wav"],
    defaultParams: {
      denoising: 0.75,
      seed: 42,
    },
    notes:
      "Diffusion-based audio spectrogram synthesis. Great for fast prototyping and stylized soundscapes.",
    docsUrl: "https://replicate.com/riffusion/riffusion",
  },
  "bark-v0": {
    id: withEnvOverride(
      process.env.REPLICATE_BARK_MODEL,
      BARK_DEFAULT_MODEL,
    ),
    name: "Bark (Music & Speech)",
    kind: "music_generation",
    vendor: "replicate",
    capabilities: ["music-generation", "voice-cloning"],
    bestFor: ["experimental vocals", "spoken-word musical pieces"],
    estimatedCost: 0.05,
    costUnit: "per request",
    latencySeconds: 12,
    maxDurationSeconds: 20,
    outputFormats: ["wav"],
    defaultParams: {
      history_prompt: null,
      text_temp: 0.7,
      waveform_temp: 0.7,
    },
    notes:
      "Hybrid speech + music model. Useful for creative audio beds or stylized narration with background layers.",
    docsUrl: "https://replicate.com/suno-ai/bark",
  },

  // --- Voice synthesis (ElevenLabs) ---
  "elevenlabs-multilingual-v2": {
    id: withEnvOverride(
      process.env.ELEVENLABS_MODEL_MULTILINGUAL,
      "eleven_monolingual_v2",
    ),
    name: "ElevenLabs Multilingual v2",
    kind: "voice_synthesis",
    vendor: "elevenlabs",
    capabilities: ["voice-cloning", "ssml", "emotion-control"],
    bestFor: ["global campaigns", "multi-language product explainers"],
    estimatedCost: 0.24,
    costUnit: "per 1K characters",
    latencySeconds: 5,
    outputFormats: ["mp3", "wav"],
    defaultParams: {
      optimize_streaming_latency: 1,
    },
    notes:
      "Premium TTS with 29+ languages, style controls, and cloned voice support. Requires ElevenLabs API key.",
    docsUrl: "https://api.elevenlabs.io/docs",
  },
  "elevenlabs-conversational-v1": {
    id: withEnvOverride(
      process.env.ELEVENLABS_MODEL_CONVERSATIONAL,
      "eleven_monologue_v1",
    ),
    name: "ElevenLabs Conversational v1",
    kind: "voice_synthesis",
    vendor: "elevenlabs",
    capabilities: ["voice-cloning", "emotion-control"],
    bestFor: ["dialogue", "narration", "highly expressive reads"],
    estimatedCost: 0.18,
    costUnit: "per 1K characters",
    latencySeconds: 4,
    outputFormats: ["mp3", "wav"],
    defaultParams: {
      stability: 0.35,
      similarity_boost: 0.7,
    },
    notes:
      "Optimized for lifelike conversational pacing. Great drop-in replacement for the current MiniMax narration flow.",
    docsUrl: "https://docs.elevenlabs.io/api-reference/text-to-speech",
  },
  "replicate-minimax-tts": {
    id: withEnvOverride(
      process.env.REPLICATE_MINIMAX_TTS_MODEL ??
        process.env.REPLICATE_MINIMAX_TTS_MODEL_ID,
      MINIMAX_SPEECH_DEFAULT_MODEL,
    ),
    name: "MiniMax Speech 02 HD",
    kind: "voice_synthesis",
    vendor: "replicate",
    capabilities: ["voice-cloning", "emotion-control"],
    bestFor: [
      "cost-effective narration",
      "quick voice previews",
      "Sync Labs lip sync compatibility",
    ],
    estimatedCost: 0.012,
    costUnit: "per 1K characters",
    latencySeconds: 6,
    outputFormats: ["wav"],
    defaultParams: {
      sample_rate: 44100,
      audio_format: "wav",
      bitrate: 128000,
      channel: "mono",
    },
    notes:
      "Current production narrator. Runs on Replicate using MiniMax Speech HD for neutral English voices.",
    docsUrl: "https://replicate.com/minimax/speech-02-hd",
  },
  "replicate-minimax-turbo": {
    id: withEnvOverride(
      process.env.REPLICATE_MINIMAX_TURBO_MODEL,
      MINIMAX_SPEECH_TURBO_MODEL,
    ),
    name: "MiniMax Speech 02 Turbo",
    kind: "voice_synthesis",
    vendor: "replicate",
    capabilities: ["voice-cloning", "emotion-control"],
    bestFor: [
      "real-time voice generation",
      "interactive experiences",
      "fast iteration and preview",
    ],
    estimatedCost: 0.008,
    costUnit: "per 1K characters",
    latencySeconds: 2,
    outputFormats: ["wav"],
    defaultParams: {
      sample_rate: 44100,
      audio_format: "wav",
      bitrate: 128000,
      channel: "mono",
    },
    notes:
      "Ultra-low latency version of MiniMax Speech 02. Ideal for real-time generation in video editor.",
    docsUrl: "https://replicate.com/minimax/speech-02-turbo",
  },
  "bark-voice": {
    id: withEnvOverride(
      process.env.REPLICATE_BARK_MODEL,
      BARK_DEFAULT_MODEL,
    ),
    name: "Bark Hybrid Voice",
    kind: "voice_synthesis",
    vendor: "replicate",
    capabilities: ["voice-cloning", "music-generation", "sound-effects"],
    bestFor: [
      "narration with sound effects",
      "stylized dialogue",
      "audio notes that blend speech and music",
    ],
    estimatedCost: 0.05,
    costUnit: "per request",
    latencySeconds: 12,
    maxDurationSeconds: 20,
    outputFormats: ["wav"],
    defaultParams: {
      history_prompt: null,
      text_temp: 0.7,
      waveform_temp: 0.7,
    },
    notes:
      "Suno Bark via Replicate. Accepts inline audio direction tags like [music], [laughter], or [applause] for hybrid delivery.",
    docsUrl: "https://replicate.com/suno-ai/bark",
  },

  // --- Stock audio / sound effects (Freesound) ---
  "freesound-music-library": {
    id: "freesound/music",
    name: "Freesound Music Library",
    kind: "sound_library",
    vendor: "freesound",
    capabilities: ["sound-effects", "stock-library"],
    bestFor: ["licensed background tracks", "sound effects", "ambient loops"],
    estimatedCost: 0,
    costUnit: "per request",
    latencySeconds: 2,
    outputFormats: ["mp3"],
    defaultParams: {
      per_page: 20,
      safesearch: true,
    },
    notes:
      "Powered by Freesound.org community uploads. Requires FREESOUND_API_KEY and respects Creative Commons licensing.",
    docsUrl:
      "https://freesound.org/docs/api/resources_apiv2.html#search-text",
  },
  "freesound-sfx-library": {
    id: "freesound/sound-effects",
    name: "Freesound Sound Effects",
    kind: "sound_library",
    vendor: "freesound",
    capabilities: ["sound-effects", "stock-library"],
    bestFor: ["transitions", "UI clicks", "ambient layers"],
    estimatedCost: 0,
    costUnit: "per request",
    latencySeconds: 2,
    outputFormats: ["mp3"],
    defaultParams: {
      per_page: 20,
      safesearch: true,
    },
    notes:
      "Same Freesound integration but tuned for SFX tagging and shorter clips.",
    docsUrl:
      "https://freesound.org/docs/api/resources_apiv2.html#search-text",
  },

};

export const DEFAULT_MUSIC_MODEL = "lyria-2";
export const DEFAULT_VOICE_MODEL = "elevenlabs-multilingual-v2";

export function getAudioModel(key: string): AudioModel {
  return AUDIO_MODELS[key] || AUDIO_MODELS[DEFAULT_MUSIC_MODEL];
}

export function getModelsByKind(
  kind: AudioModelKind,
): AudioModel[] {
  return Object.values(AUDIO_MODELS).filter((model) => model.kind === kind);
}

export function getModelsByVendor(
  vendor: AudioVendor,
): AudioModel[] {
  return Object.values(AUDIO_MODELS).filter((model) => model.vendor === vendor);
}

/**
 * Provider abstraction interfaces
 * Consuming code should depend on these instead of vendor-specific SDKs.
 */

export interface BaseAudioProviderAdapter {
  providerKey: keyof typeof AUDIO_MODELS;
  vendor: AudioVendor;
  kind: AudioModelKind;
}

export interface MusicGenerationRequest {
  prompt: string;
  durationSeconds?: number;
  referenceAudioUrl?: string;
  style?: string;
  tempo?: string;
  negativePrompt?: string;
  seed?: number;
  historyPrompt?: string | null;
  textTemperature?: number;
  waveformTemperature?: number;
}

export interface AudioTrackResult {
  audioUrl: string;
  format: string;
  durationSeconds: number;
  metadata?: Record<string, unknown>;
}

export interface MusicGenerationAdapter extends BaseAudioProviderAdapter {
  kind: "music_generation";
  generateTrack(
    request: MusicGenerationRequest,
  ): Promise<AudioTrackResult>;
}

export interface VoiceSynthesisRequest {
  text: string;
  voiceId?: string;
  emotion?: string;
  speed?: number;
  pitch?: number;
  ssml?: string;
  outputFormat?: string;
  historyPrompt?: string | null;
  textTemp?: number;
  waveformTemp?: number;
}

export interface VoiceSynthesisResult extends AudioTrackResult {
  voiceId?: string;
  voiceName?: string;
}

export interface VoiceSynthesisAdapter extends BaseAudioProviderAdapter {
  kind: "voice_synthesis";
  synthesizeVoice(
    request: VoiceSynthesisRequest,
  ): Promise<VoiceSynthesisResult>;
}

export interface SoundLibrarySearchRequest {
  query: string;
  category?: string;
  mood?: string;
  durationRange?: [number, number];
  page?: number;
  perPage?: number;
}

export interface SoundLibraryResult {
  id: string;
  title: string;
  url: string;
  streamUrl?: string;
  downloadUrl?: string;
  durationSeconds: number;
  tags: string[];
  previewUrl?: string;
  waveformUrl?: string;
  attribution?: string;
}

export interface SoundLibraryAdapter extends BaseAudioProviderAdapter {
  kind: "sound_library";
  searchLibrary(
    request: SoundLibrarySearchRequest,
  ): Promise<SoundLibraryResult[]>;
}
