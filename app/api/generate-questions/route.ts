import { generateObject } from "ai";
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

    // Generate clarifying questions using OpenAI
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: questionSchema,
      system: QUESTION_GENERATION_SYSTEM_PROMPT,
      prompt: buildQuestionGenerationPrompt(prompt),
    });

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error generating questions:", error);
    return NextResponse.json(
      { error: "Failed to generate questions" },
      { status: 500 },
    );
  }
}
