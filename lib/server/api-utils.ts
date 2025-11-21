import "server-only";
import { groq } from "@ai-sdk/groq";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { apiError } from "@/lib/api-response";
import { NextResponse } from "next/server";

/**
 * Create an LLM provider with automatic fallback logic.
 * Prefers Groq for speed, falls back to OpenAI if Groq unavailable.
 *
 * @param modelId - Optional model ID to use (e.g., "openai/gpt-oss-20b", "gpt-4o-mini")
 */
export function createLLMProvider(modelId?: string): {
  provider: LanguageModel;
  providerName: string;
} {
  const hasGroqKey = !!process.env.GROQ_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

  if (!hasGroqKey && !hasOpenAIKey) {
    throw new Error("No API keys configured");
  }

  // If a specific model is requested, use it
  if (modelId) {
    // Check if it's a Groq model (Groq models have the "provider/" format)
    if (modelId === "openai/gpt-oss-20b" || modelId.includes("/")) {
      if (!hasGroqKey) {
        throw new Error("Groq API key not configured");
      }
      return {
        provider: groq(modelId),
        providerName: `Groq (${modelId})`,
      };
    }

    // Check if it's an OpenAI model (OpenAI models start with "gpt-")
    if (modelId.startsWith("gpt-")) {
      if (!hasOpenAIKey) {
        throw new Error("OpenAI API key not configured");
      }
      return {
        provider: openai(modelId),
        providerName: `OpenAI (${modelId})`,
      };
    }

    // Unknown model - log warning and use default
    console.warn(`Unknown model specified: ${modelId}, using default`);
  }

  // Default behavior: prefer Groq for speed
  if (hasGroqKey) {
    return {
      provider: groq("openai/gpt-oss-20b"),
      providerName: "Groq (gpt-oss-20b)",
    };
  }

  return {
    provider: openai("gpt-4o-mini"),
    providerName: "OpenAI (gpt-4o-mini)",
  };
}

/**
 * Validate that at least one LLM API key is configured.
 * Returns an error response if no keys are found.
 */
export function validateAPIKeys(): NextResponse | null {
  const hasGroqKey = !!process.env.GROQ_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

  if (!hasGroqKey && !hasOpenAIKey) {
    return apiError(
      "No API keys configured",
      500,
      "Please set GROQ_API_KEY or OPENAI_API_KEY in your .env.local file",
    );
  }

  return null;
}
