import "server-only";
import { groq } from "@ai-sdk/groq";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { apiError } from "@/lib/api-response";
import { NextResponse } from "next/server";

/**
 * Create an LLM provider with automatic fallback logic.
 * Prefers Groq for speed, falls back to OpenAI if Groq unavailable.
 */
export function createLLMProvider(): {
  provider: LanguageModel;
  providerName: string;
} {
  const hasGroqKey = !!process.env.GROQ_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

  if (!hasGroqKey && !hasOpenAIKey) {
    throw new Error("No API keys configured");
  }

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

