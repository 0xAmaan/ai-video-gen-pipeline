import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { NextResponse } from "next/server";

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
      system: `You are an expert video production consultant. Your job is to ask clarifying questions that will help refine a user's video idea into a clear, actionable vision.

Rules:
- Generate 3-5 highly contextual questions based on the specific video prompt
- Each question should have 2-4 answer options
- Questions should uncover missing details like: emotion, visual style, pacing, tone, audience, key message, transformation, etc.
- Make questions specific to the video type (product demo, tutorial, story, etc.)
- Each option needs: a short label (2-5 words), a kebab-case value, and a descriptive explanation
- Question IDs should be kebab-case descriptive names (e.g., "primary-emotion", "visual-style")

Example output structure:
{
  "questions": [
    {
      "id": "primary-emotion",
      "question": "What emotion should viewers feel?",
      "options": [
        {
          "label": "Inspired & Motivated",
          "value": "inspired",
          "description": "Uplifting content that energizes viewers"
        },
        {
          "label": "Calm & Reassured",
          "value": "calm",
          "description": "Soothing tone that builds trust"
        }
      ]
    }
  ]
}`,
      prompt: `Video idea: "${prompt}"

Generate 3-5 clarifying questions that will help refine this video concept. Focus on what's unclear or missing - don't ask about things already specified in the prompt.`,
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
