/**
 * Voice model configurations for the editor voice generation panel
 * 
 * Defines available voice providers, models, and their metadata.
 * Extracted from VoiceGenerationPanel for better maintainability.
 */

export type VoiceProvider = "replicate" | "elevenlabs";

/**
 * Voice provider configuration
 */
export interface ProviderOption {
  id: VoiceProvider;
  label: string;
  defaultModel: string;
}

/**
 * Voice model configuration
 */
export interface ModelOption {
  value: string;
  label: string;
  description: string;
}

/**
 * Available voice providers with their default models
 */
export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: "replicate",
    label: "Replicate (MiniMax)",
    defaultModel: "replicate-minimax-turbo",
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    defaultModel: "elevenlabs-multilingual-v2",
  },
];

/**
 * Replicate voice models (MiniMax & Bark)
 */
export const REPLICATE_MODELS: ModelOption[] = [
  {
    value: "replicate-minimax-turbo",
    label: "MiniMax Turbo",
    description: "Ultra-fast, real-time generation",
  },
  {
    value: "replicate-minimax-tts",
    label: "MiniMax HD",
    description: "Highest quality, 99% vocal match",
  },
  {
    value: "bark-voice",
    label: "Bark Hybrid",
    description: "Speech + sound effects",
  },
];

/**
 * ElevenLabs voice models
 */
export const ELEVENLABS_MODELS: ModelOption[] = [
  {
    value: "elevenlabs-multilingual-v2",
    label: "Multilingual v2",
    description: "Best for global narration",
  },
  {
    value: "elevenlabs-conversational-v1",
    label: "Conversational v1",
    description: "Natural dialogue style",
  },
];

/**
 * Maximum text length for voice generation (approximately 30 minutes of audio)
 */
export const MAX_TEXT_LENGTH = 5000;

/**
 * Request timeout in milliseconds (30 seconds)
 */
export const REQUEST_TIMEOUT = 30000;

/**
 * Sample text for voice previews
 */
export const PREVIEW_SAMPLE_TEXT = "Hello there! Here's a quick preview of this narration voice.";
