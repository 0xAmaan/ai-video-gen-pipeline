import { generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { NextResponse } from "next/server";
import {
  QUESTION_GENERATION_SYSTEM_PROMPT,
  buildQuestionGenerationPrompt,
} from "@/lib/prompts";

// Zod schema matching the Question interface from InputPhase
const questionSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string(),
        question: z.string(),
        options: z
          .array(
            z.object({
              label: z.string(),
              value: z.string(),
              description: z.string(),
            }),
          )
          .min(2)
          .max(4),
      }),
    )
    .min(3)
    .max(5),
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Invalid prompt provided" },
        { status: 400 },
      );
    }

    // Check if Groq API key is available
    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    if (!hasGroqKey && !hasOpenAIKey) {
      console.error("❌ No API keys found! Set GROQ_API_KEY or OPENAI_API_KEY in .env.local");
      return NextResponse.json(
        {
          error: "No API keys configured",
          details: "Please set GROQ_API_KEY or OPENAI_API_KEY in your .env.local file"
        },
        { status: 500 },
      );
    }

    // Generate clarifying questions using Groq (much faster) or OpenAI (fallback)
    // Note: Using openai/gpt-oss-20b - supports strict JSON schema, 250K TPM, very fast
    const modelToUse = hasGroqKey
      ? groq("openai/gpt-oss-20b")
      : openai("gpt-4o-mini");

    console.log(`🔧 Using model: ${hasGroqKey ? "Groq (gpt-oss-20b)" : "OpenAI (gpt-4o-mini)"}`);

    const { object } = await generateObject({
      model: modelToUse,
      schema: questionSchema,
      system: QUESTION_GENERATION_SYSTEM_PROMPT,
      prompt: buildQuestionGenerationPrompt(prompt),
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error generating questions:", error);
    console.error("Full error details:", error instanceof Error ? error.message : error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      {
        error: "Failed to generate questions",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 },
    );
  }
}
