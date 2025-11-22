/**
 * Model configuration types for AI video generation pipeline
 */

export type ModelProvider = "groq" | "openai" | "replicate" | "minimax" | "kwaivgi" | "bytedance" | "google";

export type SpeedCategory = "fast" | "medium" | "slow";

export type CostCategory = "low" | "medium" | "high";

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  speed: SpeedCategory;
  cost: CostCategory;
  description?: string;
  maxTokens?: number;
  supportsJsonMode?: boolean;
  supportsImageInput?: boolean;
  supportsVideoGeneration?: boolean;
  isAvailable?: boolean;
}

export interface TextToTextModel extends ModelConfig {
  provider: "groq" | "openai";
  supportsJsonMode: true;
}

export interface TextToImageModel extends ModelConfig {
  provider: "openai" | "replicate";
  supportsImageInput: boolean;
  supportsVideoGeneration: false;
}

export interface ImageToVideoModel extends ModelConfig {
  provider: "replicate" | "minimax" | "kwaivgi" | "bytedance" | "google";
  supportsImageInput: true;
  supportsVideoGeneration: true;
  modelPath: string;
  defaultDuration?: number;
  supportedResolutions?: string[];
  supportedAspectRatios?: string[];
}

export interface ModelSelectionState {
  textToTextModel: string;
  textToImageModel: string;
  imageToVideoModel: string;
  sceneRegenerationModel: string; // Uses same model as textToImageModel
}

export interface FeatureToggleState {
  modelSelectionEnabled: boolean;
}

// Model configurations for Step 1: Text → Text
export const TEXT_TO_TEXT_MODELS: TextToTextModel[] = [
  {
    id: "openai/gpt-oss-20b",
    name: "GPT-OSS-20B (Groq)",
    provider: "groq",
    speed: "fast",
    cost: "low",
    description: "Fast open-source model via Groq, optimized for JSON output",
    maxTokens: 250000,
    supportsJsonMode: true,
    isAvailable: true,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o-mini",
    provider: "openai",
    speed: "medium",
    cost: "low",
    description: "OpenAI's efficient mini model",
    maxTokens: 128000,
    supportsJsonMode: true,
    isAvailable: true,
  },
  {
    id: "gpt-5-nano-2025-08-07",
    name: "GPT-5 Nano",
    provider: "openai",
    speed: "fast",
    cost: "medium",
    description: "Latest GPT-5 nano model with improved reasoning",
    maxTokens: 128000,
    supportsJsonMode: true,
    isAvailable: true,
  },
  {
    id: "gpt-5-mini-2025-08-07",
    name: "GPT-5 Mini",
    provider: "openai",
    speed: "medium",
    cost: "medium",
    description: "Latest GPT-5 mini model with enhanced capabilities",
    maxTokens: 128000,
    supportsJsonMode: true,
    isAvailable: true,
  },
  {
    id: "gpt-4.1-mini-2025-04-14",
    name: "GPT-4.1 Mini",
    provider: "openai",
    speed: "medium",
    cost: "medium",
    description: "Refined GPT-4 mini model with improved performance",
    maxTokens: 128000,
    supportsJsonMode: true,
    isAvailable: true,
  },
];

// Text-to-Image models from lib/image-models.ts - mapped to our interface
export const TEXT_TO_IMAGE_MODELS: TextToImageModel[] = [
  {
    id: "leonardo-phoenix",
    name: "Leonardo Phoenix 1.0",
    provider: "replicate",
    speed: "medium",
    cost: "medium",
    description: "Exceptional prompt adherence and photorealistic results",
    supportsImageInput: false,
    supportsVideoGeneration: false,
    isAvailable: true,
  },
  {
    id: "flux-schnell",
    name: "FLUX.1 Schnell",
    provider: "replicate",
    speed: "fast",
    cost: "low",
    description: "Streamlined for speed when users aren't sure what they want",
    supportsImageInput: false,
    supportsVideoGeneration: false,
    isAvailable: true,
  },
  {
    id: "flux-pro",
    name: "FLUX.1 Pro",
    provider: "replicate",
    speed: "medium",
    cost: "medium",
    description: "Excellent for images with crisp text and multi-scene consistency",
    supportsImageInput: false,
    supportsVideoGeneration: false,
    isAvailable: true,
  },
  {
    id: "flux-pro-ultra",
    name: "FLUX.1 Pro Ultra",
    provider: "replicate",
    speed: "medium",
    cost: "high",
    description: "Ultra-high resolution and maximum quality output",
    supportsImageInput: false,
    supportsVideoGeneration: false,
    isAvailable: true,
  },
  {
    id: "consistent-character",
    name: "Consistent Character (InstantID + IPAdapter)",
    provider: "replicate",
    speed: "medium",
    cost: "medium",
    description: "Best for character consistency across different poses and scenes",
    supportsImageInput: false,
    supportsVideoGeneration: false,
    isAvailable: true,
  },
  {
    id: "sdxl-lightning",
    name: "SDXL Lightning",
    provider: "replicate",
    speed: "fast",
    cost: "low",
    description: "Millisecond generation with photorealistic results",
    supportsImageInput: false,
    supportsVideoGeneration: false,
    isAvailable: true,
  },
  {
    id: "sdxl",
    name: "Stable Diffusion XL",
    provider: "replicate",
    speed: "medium",
    cost: "low",
    description: "XL backbone offering photorealism and prompt accuracy",
    supportsImageInput: false,
    supportsVideoGeneration: false,
    isAvailable: true,
  },
  {
    id: "sd3-medium",
    name: "Stable Diffusion 3 Medium",
    provider: "replicate",
    speed: "medium",
    cost: "medium",
    description: "High-fidelity with LoRA integration support",
    supportsImageInput: false,
    supportsVideoGeneration: false,
    isAvailable: true,
  },
  {
    id: "sd3-turbo",
    name: "Stable Diffusion 3 Turbo",
    provider: "replicate",
    speed: "fast",
    cost: "low",
    description: "Speed-optimized SD3 variant",
    supportsImageInput: false,
    supportsVideoGeneration: false,
    isAvailable: true,
  },
  {
    id: "hidream-i1",
    name: "HiDream-I1",
    provider: "replicate",
    speed: "medium",
    cost: "medium",
    description: "State-of-the-art artistic and photorealistic results",
    supportsImageInput: false,
    supportsVideoGeneration: false,
    isAvailable: true,
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    provider: "replicate",
    speed: "medium",
    cost: "medium",
    description: "Upgraded Nano Banana with better prompt adherence and reference image support",
    supportsImageInput: true,
    supportsVideoGeneration: false,
    isAvailable: true,
  },
  {
    id: "nano-banana",
    name: "Nano Banana",
    provider: "replicate",
    speed: "fast",
    cost: "low",
    description: "Legacy model, used as fallback option",
    supportsImageInput: true,
    supportsVideoGeneration: false,
    isAvailable: true,
  },
];

// Image-to-Video models from PRD
export const IMAGE_TO_VIDEO_MODELS: ImageToVideoModel[] = [
  {
    id: "wan-video/wan-2.5-i2v-fast",
    name: "WAN 2.5 Image-to-Video Fast",
    provider: "replicate",
    speed: "fast",
    cost: "medium",
    description: "Current default model for high-quality video generation - supports 5-second videos",
    supportsImageInput: true,
    supportsVideoGeneration: true,
    modelPath: "wan-video/wan-2.5-i2v-fast",
    defaultDuration: 5,
    supportedResolutions: ["720p", "1080p"],
    isAvailable: true,
  },
  {
    id: "bytedance/seedance-1-lite",
    name: "SeéDance 1.0 Lite",
    provider: "bytedance",
    speed: "medium",
    cost: "medium",
    description: "Lightweight model with good motion quality - supports 5-second videos",
    supportsImageInput: true,
    supportsVideoGeneration: true,
    modelPath: "bytedance/seedance-1-lite",
    defaultDuration: 5,
    supportedResolutions: ["480p", "720p", "1080p"],
    supportedAspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "9:21"],
    isAvailable: true,
  },
  {
    id: "google/veo-3.1",
    name: "Veo 3.1",
    provider: "google",
    speed: "slow",
    cost: "high",
    description: "Google's high-quality video generation with audio support - supports videos of length 4, 6, and 8 seconds",
    supportsImageInput: true,
    supportsVideoGeneration: true,
    modelPath: "google/veo-3.1",
    defaultDuration: 8,
    supportedResolutions: ["720p", "1080p"],
    supportedAspectRatios: ["16:9", "9:16"],
    isAvailable: true,
  },
  {
    id: "google/veo-3.1-fast",
    name: "Veo 3.1 Fast",
    provider: "google",
    speed: "medium",
    cost: "high",
    description: "Faster version of Google's Veo 3.1 with audio support - supports videos of length 4, 6, and 8 seconds",
    supportsImageInput: true,
    supportsVideoGeneration: true,
    modelPath: "google/veo-3.1-fast",
    defaultDuration: 8,
    supportedResolutions: ["720p", "1080p"],
    supportedAspectRatios: ["16:9", "9:16"],
    isAvailable: true,
  },
  {
    id: "minimax/hailuo-2.3-fast",
    name: "Hailuo 2.3 Fast",
    provider: "minimax",
    speed: "fast",
    cost: "medium",
    description: "Fast video generation with prompt optimization - supports 6-second videos",
    supportsImageInput: true,
    supportsVideoGeneration: true,
    modelPath: "minimax/hailuo-2.3-fast",
    defaultDuration: 6,
    supportedResolutions: ["768p", "1080p"],
    isAvailable: true,
  },
  {
    id: "bytedance/seedance-1-pro-fast",
    name: "SeéDance 1.0 Pro Fast",
    provider: "bytedance",
    speed: "fast",
    cost: "high",
    description: "Professional fast model with camera control - supports 5-second videos",
    supportsImageInput: true,
    supportsVideoGeneration: true,
    modelPath: "bytedance/seedance-1-pro-fast",
    defaultDuration: 5,
    supportedResolutions: ["480p", "720p", "1080p"],
    supportedAspectRatios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "9:21"],
    isAvailable: true,
  },
  {
    id: "kwaivgi/kling-v2.5-turbo-pro",
    name: "Kling v2.5 Turbo Pro",
    provider: "kwaivgi",
    speed: "fast",
    cost: "high",
    description: "Professional-grade video generation with turbo speed - supports 5-second videos",
    supportsImageInput: true,
    supportsVideoGeneration: true,
    modelPath: "kwaivgi/kling-v2.5-turbo-pro",
    defaultDuration: 5,
    supportedResolutions: ["720p", "1080p"],
    supportedAspectRatios: ["16:9", "9:16", "1:1"],
    isAvailable: true,
  },
];

// Speed indicators for UI
export const SPEED_INDICATORS = {
  fast: "⚡",
  medium: "⚡⚡",
  slow: "🐌",
} as const;

// Cost indicators for UI
export const COST_INDICATORS = {
  low: "$",
  medium: "$$",
  high: "$$$",
} as const;
