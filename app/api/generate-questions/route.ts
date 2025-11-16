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
    let object;

    if (hasGroqKey) {
      console.log(`🔧 Trying Groq (gpt-oss-20b) - FAST ⚡`);
      try {
        const result = await generateObject({
          model: groq("openai/gpt-oss-20b"),
          schema: questionSchema,
          system: QUESTION_GENERATION_SYSTEM_PROMPT,
          prompt: buildQuestionGenerationPrompt(prompt),
          maxRetries: 2,
        });
        object = result.object;
      } catch (groqError) {
        console.warn(`⚠️ Groq failed, falling back to OpenAI:`, groqError instanceof Error ? groqError.message : groqError);

        if (hasOpenAIKey) {
          const result = await generateObject({
            model: openai("gpt-4o-mini"),
            schema: questionSchema,
            system: QUESTION_GENERATION_SYSTEM_PROMPT,
            prompt: buildQuestionGenerationPrompt(prompt),
            maxRetries: 2,
          });
          object = result.object;
        } else {
          throw groqError; // Re-throw if no OpenAI fallback available
        }
      }
    } else if (hasOpenAIKey) {
      console.log(`🔧 Using OpenAI (gpt-4o-mini)`);
      const result = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: questionSchema,
        system: QUESTION_GENERATION_SYSTEM_PROMPT,
        prompt: buildQuestionGenerationPrompt(prompt),
        maxRetries: 2,
      });
      object = result.object;
    } else {
      throw new Error("No API keys configured");
    }

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
