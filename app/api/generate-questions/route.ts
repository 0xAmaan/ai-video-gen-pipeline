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
    const body = await req.json();
    console.log('📥 Full request body:', JSON.stringify(body, null, 2));

    const { prompt, model } = body;
    console.log('📥 Extracted - prompt:', prompt, 'model:', model);

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Invalid prompt provided" },
        { status: 400 },
      );
    }

    // Validate model parameter if provided
    if (model && typeof model !== "string") {
      return NextResponse.json(
        { error: "Invalid model provided" },
        { status: 400 },
      );
    }

    // Function to determine which model to use based on parameter
    const getModelConfig = (modelId: string | undefined) => {
      // If no model specified, use default behavior (Groq first, then OpenAI)
      if (!modelId) {
        return { provider: null, model: null };
      }

      // Check if it's a Groq model (openai/gpt-oss-20b)
      if (modelId === "openai/gpt-oss-20b") {
        return { provider: "groq", model: groq("openai/gpt-oss-20b") };
      }

      // Check if it's an OpenAI model
      if (modelId.startsWith("gpt-")) {
        return { provider: "openai", model: openai(modelId) };
      }

      // Unknown model
      console.warn(`Unknown model specified: ${modelId}`);
      return { provider: null, model: null };
    };

    // Check if Groq API key is available
    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    if (!hasGroqKey && !hasOpenAIKey) {
      console.error(
        "❌ No API keys found! Set GROQ_API_KEY or OPENAI_API_KEY in .env.local",
      );
      return NextResponse.json(
        {
          error: "No API keys configured",
          details:
            "Please set GROQ_API_KEY or OPENAI_API_KEY in your .env.local file",
        },
        { status: 500 },
      );
    }

    // Generate clarifying questions using specified or default model
    let object;
    const modelConfig = getModelConfig(model);

    // If a specific model is requested and valid, use it
    if (modelConfig.model) {
      console.log(`🔧 Using specified model: ${model} (${modelConfig.provider})`);

      // Check if the required API key is available
      if (modelConfig.provider === "groq" && !hasGroqKey) {
        return NextResponse.json(
          {
            error: "Groq API key not configured",
            details: "Set GROQ_API_KEY in your .env.local file",
          },
          { status: 500 },
        );
      }

      if (modelConfig.provider === "openai" && !hasOpenAIKey) {
        return NextResponse.json(
          {
            error: "OpenAI API key not configured",
            details: "Set OPENAI_API_KEY in your .env.local file",
          },
          { status: 500 },
        );
      }

      try {
        const result = await generateObject({
          model: modelConfig.model,
          schema: questionSchema,
          system: QUESTION_GENERATION_SYSTEM_PROMPT,
          prompt: buildQuestionGenerationPrompt(prompt),
          maxRetries: 2,
        });
        object = result.object;
      } catch (error) {
        console.error(
          `❌ Failed to use specified model ${model}:`,
          error instanceof Error ? error.message : error,
        );

        // If a specific Groq model fails (e.g. rate limit), fall back to OpenAI
        if (modelConfig.provider === "groq" && hasOpenAIKey) {
          console.warn(
            `⚠️ Groq model ${model} failed, falling back to OpenAI (gpt-4.1-mini-2025-04-14)`,
          );
          try {
            const result = await generateObject({
              model: openai("gpt-4.1-mini-2025-04-14"),
              schema: questionSchema,
              system: QUESTION_GENERATION_SYSTEM_PROMPT,
              prompt: buildQuestionGenerationPrompt(prompt),
              maxRetries: 2,
            });
            object = result.object;
          } catch (fallbackError) {
            console.error(
              "❌ Fallback to OpenAI (gpt-4.1-mini-2025-04-14) also failed:",
              fallbackError instanceof Error
                ? fallbackError.message
                : fallbackError,
            );
            throw new Error(`Failed to use specified model: ${model}`);
          }
        } else if (modelConfig.provider === "openai" && hasGroqKey) {
          // If a specific OpenAI model fails, fall back to Groq default
          console.warn(
            `⚠️ OpenAI model ${model} failed, falling back to Groq (openai/gpt-oss-20b)`,
          );
          try {
            const result = await generateObject({
              model: groq("openai/gpt-oss-20b"),
              schema: questionSchema,
              system: QUESTION_GENERATION_SYSTEM_PROMPT,
              prompt: buildQuestionGenerationPrompt(prompt),
              maxRetries: 2,
            });
            object = result.object;
          } catch (fallbackError) {
            console.error(
              "❌ Fallback to Groq (openai/gpt-oss-20b) also failed:",
              fallbackError instanceof Error
                ? fallbackError.message
                : fallbackError,
            );
            throw new Error(`Failed to use specified model: ${model}`);
          }
        } else {
          // No fallback available
          throw new Error(`Failed to use specified model: ${model}`);
        }
      }
    } else {
      // Default behavior: Try Groq first, then fallback to OpenAI
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
          console.warn(
            `⚠️ Groq failed, falling back to OpenAI:`,
            groqError instanceof Error ? groqError.message : groqError,
          );

          if (hasOpenAIKey) {
            const result = await generateObject({
              model: openai("gpt-4.1-mini-2025-04-14"),
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
        console.log(`🔧 Using OpenAI (gpt-4.1-mini-2025-04-14)`);
        const result = await generateObject({
          model: openai("gpt-4.1-mini-2025-04-14"),
          schema: questionSchema,
          system: QUESTION_GENERATION_SYSTEM_PROMPT,
          prompt: buildQuestionGenerationPrompt(prompt),
          maxRetries: 2,
        });
        object = result.object;
      } else {
        throw new Error("No API keys configured");
      }
    }

    return NextResponse.json(object);
  } catch (error) {
    console.error("Error generating questions:", error);
    console.error(
      "Full error details:",
      error instanceof Error ? error.message : error,
    );
    console.error(
      "Stack trace:",
      error instanceof Error ? error.stack : "No stack trace",
    );
    return NextResponse.json(
      {
        error: "Failed to generate questions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
