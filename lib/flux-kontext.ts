/**
 * Character Consistency Helpers
 * Utilities for generating images with character consistency using reference images
 * Now using fofr/consistent-character (InstantID + IPAdapter) for superior results
 */

import Replicate from "replicate";
import { IMAGE_MODELS } from "./image-models";

type FaceSwapMode = "always" | "fallback" | "never";

export interface CharacterEngineRequest {
  replicate: Replicate;
  prompt: string;
  referenceImageUrl: string;
  negativePrompt?: string;
  faceSwapMode?: FaceSwapMode;
}

export interface CharacterEngineResult {
  imageUrl?: string;
  engine?: string;
  appliedFaceSwap?: boolean;
  errors: string[];
}

const envString = (value?: string | null) =>
  value && value.trim().length > 0 ? value.trim() : undefined;

const FACE_SWAP_MODEL_ID = envString(process.env.REPLICATE_FACE_SWAP_MODEL);
const FACE_SWAP_TARGET_KEY =
  envString(process.env.REPLICATE_FACE_SWAP_TARGET_KEY) ?? "target_image";
const FACE_SWAP_REFERENCE_KEY =
  envString(process.env.REPLICATE_FACE_SWAP_REFERENCE_KEY) ?? "swap_image";

/**
 * Generate an image using Consistent Character (InstantID + IPAdapter)
 * This is the BEST option for character consistency - 90-95% accuracy
 * RECOMMENDED: Use this instead of generateWithKontextPro
 */
export async function generateWithConsistentCharacter(
  replicate: Replicate,
  prompt: string,
  referenceImageUrl: string,
  options: {
    outputFormat?: "webp" | "jpg" | "png";
    outputQuality?: number; // 0-100
    seed?: number;
    negativePrompt?: string;
  } = {},
): Promise<string> {
  const modelConfig = IMAGE_MODELS["consistent-character"];
  const modelId =
    envString(process.env.REPLICATE_CONSISTENT_CHARACTER_MODEL) ||
    modelConfig.id;

  // Build optimized prompt for consistent-character
  // This model works best with clear clothing/hairstyle descriptions
  const characterPrompt = prompt;

  const output = await replicate.run(modelId as any, {
    input: {
      subject: referenceImageUrl,  // The character reference image
      prompt: characterPrompt,      // Scene description
      number_of_outputs: 1,         // Generate 1 image per scene
      number_images_per_pose: 1,    // 1 variant per pose
      randomise_poses: false,       // Don't randomize - follow prompt
      output_format: options.outputFormat || "webp",
      output_quality: options.outputQuality || 90,
      negative_prompt: options.negativePrompt || "worst quality, low quality, blurry, distorted face, disfigured, deformed",
      ...(options.seed && { seed: options.seed }),
    },
  });

  // Extract URL from Replicate output
  return extractImageUrl(output);
}

/**
 * Generate an image using FLUX Kontext Pro with a reference image
 * DEPRECATED: Use generateWithConsistentCharacter instead for better results
 * This maintains character consistency across scenes
 */
export async function generateWithKontextPro(
  replicate: Replicate,
  prompt: string,
  referenceImageUrl: string,
  options: {
    aspectRatio?: string;
    outputFormat?: "png" | "jpg";
    seed?: number;
    negativePrompt?: string;
  } = {},
): Promise<string> {
  const modelConfig = IMAGE_MODELS["flux-kontext-pro"];
  const modelId =
    envString(process.env.REPLICATE_KONTEXT_MODEL) || modelConfig.id;

  // DEPRECATED: This function is kept as a fallback but should be replaced
  // with generateWithConsistentCharacter in the future

  // Build the character consistency prompt
  // CRITICAL: Be extremely explicit about maintaining character identity
  const kontextPrompt = `${prompt}. IMPORTANT: Use the EXACT SAME PERSON from the reference image - same face, same facial features, same hair, same skin tone, same age, same everything. This must be the IDENTICAL character, just in a different scene/pose/setting. Do not change the person's appearance in any way. Only the background, lighting, and pose should change. The person's identity must remain 100% identical to the reference image.`;

  const output = await replicate.run(modelId as any, {
    input: {
      prompt: kontextPrompt,
      input_image: referenceImageUrl,
      aspect_ratio: options.aspectRatio || "16:9", // Use 16:9 for video content
      output_format: options.outputFormat || "png",
      prompt_upsampling: false, // Keep our explicit prompts, don't let model modify them
      safety_tolerance: 2, // Maximum allowed when using input images
      ...(options.negativePrompt && { negative_prompt: options.negativePrompt }),
      ...(options.seed && { seed: options.seed }),
    },
  });

  // Extract URL from Replicate output
  return extractImageUrl(output);
}

/**
 * Extract image URL from various Replicate output formats
 */
function extractImageUrl(output: any): string {
  // Handle FileOutput object (has .url() method)
  if (
    output &&
    typeof output === "object" &&
    "url" in output &&
    typeof (output as any).url === "function"
  ) {
    return (output as any).url();
  }
  // Handle array of FileOutput objects
  else if (Array.isArray(output) && output.length > 0) {
    const firstOutput = output[0];
    if (
      typeof firstOutput === "object" &&
      "url" in firstOutput &&
      typeof firstOutput.url === "function"
    ) {
      return firstOutput.url();
    } else if (typeof firstOutput === "string") {
      return firstOutput;
    }
  }
  // Handle plain string
  else if (typeof output === "string") {
    return output;
  }
  // Handle object with url property (not a function)
  else if (
    output &&
    typeof output === "object" &&
    "url" in output &&
    typeof (output as any).url === "string"
  ) {
    return (output as any).url;
  }
  // Handle object with output property
  else if (output && typeof output === "object" && "output" in output) {
    const outputData = (output as any).output;
    if (Array.isArray(outputData) && outputData.length > 0) {
      return outputData[0];
    } else if (typeof outputData === "string") {
      return outputData;
    }
  }

  throw new Error(
    `Unexpected output format from FLUX Kontext Pro: ${typeof output}`,
  );
}

/**
 * Build a character-consistent prompt for FLUX Kontext Pro
 */
export function buildKontextPrompt(
  sceneDescription: string,
  characterDescription?: string,
): string {
  let prompt = sceneDescription;

  if (characterDescription) {
    prompt = `${sceneDescription}. ${characterDescription}`;
  }

  // Add VERY explicit character consistency instructions
  prompt += ". CRITICAL: This must be the EXACT SAME PERSON from the reference image - identical face, identical facial features, identical hair, identical skin tone, identical age. The person's identity and appearance must be 100% preserved. Only the scene, background, pose, and clothing can change. Do not alter the person's face or physical characteristics in any way.";

  return prompt;
}

export async function generateSceneWithCharacterEngines(
  request: CharacterEngineRequest,
): Promise<CharacterEngineResult> {
  const { replicate, prompt, referenceImageUrl, negativePrompt } = request;
  const faceSwapMode = request.faceSwapMode ?? "fallback";
  const errors: string[] = [];

  try {
    const consistentUrl = await generateWithConsistentCharacter(
      replicate,
      prompt,
      referenceImageUrl,
      {
        negativePrompt,
      },
    );

    const consistentFaceSwap = await maybeApplyFaceSwap({
      replicate,
      prompt,
      originalImageUrl: consistentUrl,
      referenceImageUrl,
      enabled: faceSwapMode === "always",
      reason: "consistent-character",
    });

    if (consistentFaceSwap.error) {
      errors.push(
        `Face swap (consistent-character) failed: ${consistentFaceSwap.error}`,
      );
    }

    return {
      imageUrl: consistentFaceSwap.imageUrl,
      engine: consistentFaceSwap.applied
        ? "consistent-character + face-swap"
        : "consistent-character",
      appliedFaceSwap: consistentFaceSwap.applied,
      errors,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    errors.push(`Consistent Character failed: ${message}`);
    console.error("Consistent Character engine failed:", error);
  }

  try {
    const kontextUrl = await generateWithKontextPro(
      replicate,
      prompt,
      referenceImageUrl,
      {
        negativePrompt,
      },
    );

    const kontextFaceSwap = await maybeApplyFaceSwap({
      replicate,
      prompt,
      originalImageUrl: kontextUrl,
      referenceImageUrl,
      enabled: faceSwapMode !== "never",
      reason: "flux-kontext",
    });

    if (kontextFaceSwap.error) {
      errors.push(
        `Face swap (flux-kontext) failed: ${kontextFaceSwap.error}`,
      );
    }

    return {
      imageUrl: kontextFaceSwap.imageUrl,
      engine: kontextFaceSwap.applied
        ? "flux-kontext + face-swap"
        : "flux-kontext",
      appliedFaceSwap: kontextFaceSwap.applied,
      errors,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    errors.push(`FLUX Kontext Pro failed: ${message}`);
    console.error("FLUX Kontext Pro engine failed:", error);
  }

  return {
    errors,
  };
}

interface FaceSwapRequest {
  replicate: Replicate;
  prompt: string;
  originalImageUrl: string;
  referenceImageUrl: string;
  enabled: boolean;
  reason: string;
}

interface FaceSwapResult {
  imageUrl: string;
  applied: boolean;
  error?: string;
}

async function maybeApplyFaceSwap(
  params: FaceSwapRequest,
): Promise<FaceSwapResult> {
  if (!params.enabled || !FACE_SWAP_MODEL_ID) {
    return {
      imageUrl: params.originalImageUrl,
      applied: false,
    };
  }

  try {
    const input: Record<string, string> = {
      [FACE_SWAP_TARGET_KEY]: params.originalImageUrl,
      [FACE_SWAP_REFERENCE_KEY]: params.referenceImageUrl,
    };

    if (params.prompt) {
      input.prompt = params.prompt;
    }

    const output = await params.replicate.run(FACE_SWAP_MODEL_ID as any, {
      input,
    });

    return {
      imageUrl: extractImageUrl(output),
      applied: true,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`Face swap (${params.reason}) failed:`, error);
    return {
      imageUrl: params.originalImageUrl,
      applied: false,
      error: message,
    };
  }
}
