/**
 * Intelligent image model selection based on questionnaire responses
 */

import {
  IMAGE_MODELS,
  DEFAULT_IMAGE_MODEL,
  type ImageModel,
} from "./image-models";

/**
 * Select the optimal image generation model based on user responses
 * Uses a hybrid approach:
 * 1. Explicit user selection (if provided)
 * 2. Inferred from questionnaire responses
 * 3. Smart defaults based on project characteristics
 */
export function selectImageModel(
  responses: Record<string, string> | undefined,
): string {
  if (!responses) {
    return DEFAULT_IMAGE_MODEL;
  }

  // Priority 1: Explicit model selection from questionnaire
  if (responses["image-model"]) {
    const modelKey = responses["image-model"];
    if (IMAGE_MODELS[modelKey]) {
      return modelKey;
    }
  }

  // Priority 2: Explicit image generation priority
  if (responses["image-generation-priority"]) {
    const priorityMapping: Record<string, string> = {
      speed: "flux-schnell", // Fast iteration
      "text-quality": "flux-pro", // Crisp text rendering
      photorealism: "flux-pro", // Realistic photos (SDXL Lightning not available)
      artistic: "flux-schnell", // Stylized/creative (HiDream not on Replicate)
      professional: "flux-pro", // Maximum quality (flux-pro-ultra not available)
    };

    const modelKey = priorityMapping[responses["image-generation-priority"]];
    if (modelKey) {
      return modelKey;
    }
  }

  // Priority 3: Infer from visual style preference
  const visualStyle = responses["visual-style"];
  if (visualStyle) {
    const styleMapping: Record<string, string> = {
      photorealistic: "flux-pro",
      "photo-realistic": "flux-pro",
      realistic: "flux-pro",
      cinematic: "flux-pro",
      artistic: "flux-schnell",
      creative: "flux-schnell",
      stylized: "flux-schnell",
      "vector-art": "flux-schnell",
      illustrated: "flux-schnell",
      modern: "flux-pro",
      professional: "flux-pro",
    };

    const modelKey = styleMapping[visualStyle.toLowerCase()];
    if (modelKey) {
      return modelKey;
    }
  }

  // Priority 4: Check if text/logos are critical
  const includesText = responses["includes-text"];
  const hasLogos = responses["has-logos"];
  const hasTextOverlay = responses["text-overlay"];

  if (
    includesText === "yes" ||
    hasLogos === "yes" ||
    hasTextOverlay === "yes"
  ) {
    return "flux-pro"; // Best for crisp text rendering
  }

  // Priority 5: Check pacing/speed requirements
  const pacing = responses["pacing"];
  if (pacing === "fast" || pacing === "quick" || pacing === "dynamic") {
    return "flux-schnell"; // Fast generation for fast-paced content
  }

  // Priority 6: Check quality/budget preference
  const quality = responses["quality-preference"];
  if (quality === "maximum" || quality === "premium" || quality === "best") {
    return "flux-pro";
  }
  if (quality === "balanced" || quality === "good-enough") {
    return "flux-schnell";
  }

  // Priority 7: Check emotion/mood for artistic needs
  const emotion = responses["primary-emotion"] || responses["emotion"];
  const artisticEmotions = [
    "dreamy",
    "surreal",
    "whimsical",
    "mysterious",
    "ethereal",
    "melancholic",
  ];

  if (emotion && artisticEmotions.includes(emotion.toLowerCase())) {
    return "flux-schnell"; // Artistic emotions use flux-schnell for now
  }

  // Default: Fast, cost-effective, good quality
  return DEFAULT_IMAGE_MODEL;
}

/**
 * Get model configuration for selected model
 */
export function getSelectedModelConfig(
  responses: Record<string, string> | undefined,
): ImageModel {
  const modelKey = selectImageModel(responses);
  return IMAGE_MODELS[modelKey];
}

/**
 * Explain why a particular model was selected (useful for debugging/UI)
 */
export function explainModelSelection(
  responses: Record<string, string> | undefined,
): {
  modelKey: string;
  model: ImageModel;
  reason: string;
} {
  if (!responses) {
    return {
      modelKey: DEFAULT_IMAGE_MODEL,
      model: IMAGE_MODELS[DEFAULT_IMAGE_MODEL],
      reason: "No preferences provided, using default fast model",
    };
  }

  // Check each priority level and return first match
  if (responses["image-model"]) {
    const modelKey = responses["image-model"];
    if (IMAGE_MODELS[modelKey]) {
      return {
        modelKey,
        model: IMAGE_MODELS[modelKey],
        reason: "Explicitly selected by user",
      };
    }
  }

  if (responses["image-generation-priority"]) {
    const priority = responses["image-generation-priority"];
    const priorityMapping: Record<string, string> = {
      speed: "flux-schnell",
      "text-quality": "flux-pro",
      photorealism: "sdxl-lightning",
      artistic: "hidream-i1",
      professional: "flux-pro-ultra",
    };
    const modelKey = priorityMapping[priority];
    if (modelKey) {
      return {
        modelKey,
        model: IMAGE_MODELS[modelKey],
        reason: `Selected based on priority: ${priority}`,
      };
    }
  }

  const visualStyle = responses["visual-style"];
  if (visualStyle) {
    const styleMapping: Record<string, string> = {
      photorealistic: "sdxl-lightning",
      "photo-realistic": "sdxl-lightning",
      realistic: "sdxl-lightning",
      cinematic: "flux-pro",
      artistic: "hidream-i1",
      creative: "hidream-i1",
      stylized: "hidream-i1",
      "vector-art": "flux-schnell",
      illustrated: "hidream-i1",
      modern: "flux-pro",
      professional: "flux-pro",
    };
    const modelKey = styleMapping[visualStyle.toLowerCase()];
    if (modelKey) {
      return {
        modelKey,
        model: IMAGE_MODELS[modelKey],
        reason: `Inferred from visual style: ${visualStyle}`,
      };
    }
  }

  const includesText = responses["includes-text"];
  if (includesText === "yes") {
    return {
      modelKey: "flux-pro",
      model: IMAGE_MODELS["flux-pro"],
      reason: "Optimized for crisp text rendering",
    };
  }

  return {
    modelKey: DEFAULT_IMAGE_MODEL,
    model: IMAGE_MODELS[DEFAULT_IMAGE_MODEL],
    reason: "Default selection for fast, cost-effective generation",
  };
}

/**
 * Validate that a model key is valid and available
 */
export function isValidModel(modelKey: string): boolean {
  return modelKey in IMAGE_MODELS;
}

/**
 * Get recommended model for a specific scenario
 */
export function getRecommendedModel(scenario: {
  needsText?: boolean;
  needsSpeed?: boolean;
  needsQuality?: boolean;
  needsArtistic?: boolean;
  budget?: "low" | "moderate" | "high";
}): string {
  if (scenario.needsQuality && scenario.budget === "high") {
    return "flux-pro-ultra";
  }

  if (scenario.needsText) {
    return "flux-pro";
  }

  if (scenario.needsArtistic) {
    return "hidream-i1";
  }

  if (scenario.needsSpeed || scenario.budget === "low") {
    return "flux-schnell";
  }

  if (scenario.needsQuality) {
    return "flux-pro";
  }

  return DEFAULT_IMAGE_MODEL;
}
