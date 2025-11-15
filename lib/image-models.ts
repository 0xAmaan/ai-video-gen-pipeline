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
}

/**
 * Available text-to-image models with their configurations
 */
export const IMAGE_MODELS: Record<string, ImageModel> = {
  // FLUX Models (Ideogram's choice)
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

  // Legacy/fallback
  "nano-banana": {
    id: "google/nano-banana",
    name: "Nano Banana",
    speed: "fast",
    quality: "good",
    cost: "low",
    bestFor: ["fallback", "quick-generation"],
    features: ["simple", "fast"],
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
