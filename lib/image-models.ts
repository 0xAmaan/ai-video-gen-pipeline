/**
 * Text-to-Image Model Configurations
 * Centralized model definitions with capabilities, costs, and use cases
 */

export interface ImageModel {
  /** Replicate model ID or API identifier */
  id: string;
  /** Human-readable model name */
  name: string;
  /** Generation speed tier */
  speed: "fast" | "medium" | "slow";
  /** Output quality tier */
  quality: "good" | "great" | "excellent" | "best";
  /** Relative cost tier */
  cost: "low" | "moderate" | "high" | "premium";
  /** Primary use cases */
  bestFor: string[];
  /** Special capabilities */
  features: string[];
  /** Whether model requires commercial license */
  requiresLicense?: boolean;
  /** Estimated cost per image in USD */
  estimatedCost?: number;
  /** Additional notes or warnings */
  notes?: string;
  /** Whether model accepts an image input for guided variations */
  supportsImageInput?: boolean;
}

/**
 * Available text-to-image models with their configurations
 */
const withEnvOverride = (envVar: string | undefined, fallback: string) =>
  envVar && envVar.trim().length > 0 ? envVar.trim() : fallback;

export const IMAGE_MODELS: Record<string, ImageModel> = {
  // FLUX Models (Ideogram's choice)
  "leonardo-phoenix": {
    id: "leonardoai/phoenix-1.0",
    name: "Leonardo Phoenix 1.0",
    speed: "medium",
    quality: "excellent",
    cost: "moderate",
    bestFor: [
      "cinematic",
      "photorealism",
      "high-quality",
      "prompt-adherence",
      "professional",
    ],
    features: [
      "cinematic-quality",
      "photorealistic",
      "prompt-adherence",
      "style-presets",
      "up-to-5mp",
    ],
    estimatedCost: 0.032,
    notes:
      "Leonardo AI's foundational model. Exceptional prompt adherence and photorealistic results. Supports multiple styles (cinematic, portrait, etc.).",
  },

  "flux-schnell": {
    id: "black-forest-labs/flux-schnell",
    name: "FLUX.1 Schnell",
    speed: "fast",
    quality: "good",
    cost: "low",
    bestFor: ["speed", "iteration", "budget", "exploration", "artistic"],
    features: [
      "fast-generation",
      "ideogram-style",
      "good-for-uncertain-users",
    ],
    estimatedCost: 0.003,
    notes:
      "Streamlined for speed when users aren't sure what they want. This is what Ideogram uses.",
  },

  "flux-pro": {
    id: "black-forest-labs/flux-1.1-pro",
    name: "FLUX.1 Pro",
    speed: "medium",
    quality: "excellent",
    cost: "moderate",
    bestFor: [
      "text-rendering",
      "consistency",
      "logos",
      "professional",
      "photorealism",
      "high-quality",
    ],
    features: [
      "crisp-text",
      "multi-scene-consistency",
      "high-quality",
      "prompt-adherence",
      "photorealistic",
    ],
    estimatedCost: 0.04,
    notes:
      "Excellent for images with crisp text, can produce multiple images for consistency across scenes. Also good for photorealistic content.",
  },

  "flux-pro-ultra": {
    id: "black-forest-labs/flux-1.1-pro-ultra",
    name: "FLUX.1 Pro Ultra",
    speed: "medium",
    quality: "best",
    cost: "high",
    bestFor: ["high-resolution", "professional", "print-quality"],
    features: ["ultra-high-res", "maximum-quality", "professional-output"],
    estimatedCost: 0.055,
    notes:
      "⚠️ May not be available on Replicate. Using flux-pro as alternative.",
  },

  "flux-kontext-pro": {
    id: withEnvOverride(
      process.env.REPLICATE_KONTEXT_MODEL,
      "black-forest-labs/flux-kontext-pro",
    ),
    name: "FLUX.1 Kontext Pro",
    speed: "medium",
    quality: "excellent",
    cost: "moderate",
    bestFor: [
      "character-consistency",
      "image-reference",
      "scene-variation",
      "character-preservation",
    ],
    features: [
      "reference-image-support",
      "character-consistency",
      "high-quality",
      "prompt-adherence",
    ],
    estimatedCost: 0.04,
    notes:
      "DEPRECATED: Use consistent-character instead for better results. Image-to-image model that maintains character consistency across scenes using a reference image. Requires input_image parameter.",
  },

  "consistent-character": {
    id: withEnvOverride(
      process.env.REPLICATE_CONSISTENT_CHARACTER_MODEL,
      "fofr/consistent-character",
    ),
    name: "Consistent Character (InstantID + IPAdapter)",
    speed: "medium",
    quality: "excellent",
    cost: "moderate",
    bestFor: [
      "character-consistency",
      "face-preservation",
      "pose-variation",
      "multi-scene-consistency",
      "photorealism",
    ],
    features: [
      "instantid-technology",
      "ipadapter-integration",
      "controlnet-support",
      "face-detailing",
      "90-95-percent-consistency",
      "pose-control",
    ],
    estimatedCost: 0.073,
    notes:
      "⭐ BEST FOR CHARACTER CONSISTENCY. Uses InstantID + IPAdapter + ControlNet for 90-95% character preservation across different poses and scenes. Purpose-built for maintaining identical characters.",
  },

  // SDXL Models
  "sdxl-lightning": {
    id: "bytedance/sdxl-lightning-4step",
    name: "SDXL Lightning",
    speed: "fast",
    quality: "great",
    cost: "low",
    bestFor: ["photorealism", "speed", "realistic-photography"],
    features: [
      "millisecond-generation",
      "photorealistic",
      "prompt-accuracy",
      "1024x1024",
    ],
    estimatedCost: 0.004,
    notes:
      "⚠️ Model may not be available on Replicate. Using SDXL as fallback internally.",
  },

  "sdxl": {
    id: "stability-ai/sdxl",
    name: "Stable Diffusion XL",
    speed: "medium",
    quality: "great",
    cost: "low",
    bestFor: ["photorealism", "versatility", "general-purpose"],
    features: ["photorealistic", "prompt-accuracy", "versatile"],
    estimatedCost: 0.008,
    notes: "XL backbone offering photorealism and prompt accuracy.",
  },

  // Stable Diffusion 3 (requires license for commercial use)
  "sd3-medium": {
    id: "stability-ai/stable-diffusion-3-medium",
    name: "Stable Diffusion 3 Medium",
    speed: "medium",
    quality: "excellent",
    cost: "moderate",
    bestFor: ["high-fidelity", "lora-integration", "customization"],
    features: [
      "high-fidelity",
      "lora-support",
      "open-source",
      "customizable",
    ],
    requiresLicense: true,
    estimatedCost: 0.035,
    notes:
      "⚠️ Open source but cannot be used for commercial purposes without license. Great for highly realistic text-to-image with face-locked LoRA.",
  },

  "sd3-turbo": {
    id: "stability-ai/stable-diffusion-3-turbo",
    name: "Stable Diffusion 3 Turbo",
    speed: "fast",
    quality: "great",
    cost: "low",
    bestFor: ["speed", "flexibility", "iteration"],
    features: ["fast-generation", "lora-support", "flexible"],
    requiresLicense: true,
    estimatedCost: 0.012,
    notes: "⚠️ Requires license for commercial use. Speed-optimized SD3 variant.",
  },

  // HiDream (artistic + photorealistic)
  "hidream-i1": {
    id: "hidream/hidream-i1",
    name: "HiDream-I1",
    speed: "medium",
    quality: "excellent",
    cost: "moderate",
    bestFor: ["artistic", "photorealistic", "creative", "mood"],
    features: [
      "17b-parameters",
      "state-of-the-art",
      "artistic-range",
      "photorealistic-capable",
    ],
    estimatedCost: 0.03,
    notes:
      "Open-source 17B parameter model delivering state-of-the-art artistic and photorealistic results.",
  },

  // Google Nano Banana family
  "nano-banana-pro": {
    id: "google/nano-banana-pro",
    name: "Nano Banana Pro",
    speed: "fast",
    quality: "great",
    cost: "low",
    bestFor: ["brand-consistency", "quick-generation"],
    features: ["simple", "fast", "reference-image-support"],
    supportsImageInput: true,
    estimatedCost: 0.004,
    notes:
      "Supports up to 14 reference images via image_input and matches their aspect ratio automatically.",
  },

  // Legacy/fallback
  "nano-banana": {
    id: "google/nano-banana",
    name: "Nano Banana",
    speed: "fast",
    quality: "good",
    cost: "low",
    bestFor: ["fallback", "quick-generation"],
    features: ["simple", "fast"],
    supportsImageInput: true,
    estimatedCost: 0.003,
    notes: "Legacy model, used as fallback option.",
  },
};

/**
 * Default model to use when no preference is specified
 */
export const DEFAULT_IMAGE_MODEL = "flux-schnell";

/**
 * Fallback model if primary selection fails
 */
export const FALLBACK_IMAGE_MODEL = "nano-banana";

/**
 * Get model configuration by key
 */
export function getImageModel(modelKey: string): ImageModel {
  return IMAGE_MODELS[modelKey] || IMAGE_MODELS[DEFAULT_IMAGE_MODEL];
}

/**
 * Get all available models (excluding those requiring licenses)
 */
export function getAvailableModels(
  includeLicensed: boolean = false,
): Record<string, ImageModel> {
  if (includeLicensed) {
    return IMAGE_MODELS;
  }

  return Object.fromEntries(
    Object.entries(IMAGE_MODELS).filter(
      ([_, model]) => !model.requiresLicense,
    ),
  );
}

/**
 * Get models suitable for a specific use case
 */
export function getModelsByUseCase(useCase: string): ImageModel[] {
  return Object.values(IMAGE_MODELS).filter((model) =>
    model.bestFor.includes(useCase),
  );
}
