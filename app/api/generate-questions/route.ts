import { generateObject } from "ai";
import { z } from "zod";
import {
  QUESTION_GENERATION_SYSTEM_PROMPT,
  buildQuestionGenerationPrompt,
} from "@/lib/prompts";
import { getFlowTracker } from "@/lib/flow-tracker";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { mockClarifyingQuestions, mockDelay } from "@/lib/demo-mocks";
import { apiResponse, apiError } from "@/lib/api-response";
import { createLLMProvider, validateAPIKeys } from "@/lib/server/api-utils";

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
  const flowTracker = getFlowTracker();
  const startTime = Date.now();

  try {
    const { prompt } = await req.json();

    // Get demo mode from headers
    const demoMode = getDemoModeFromHeaders(req.headers);
    const shouldMock = demoMode === "no-cost";

    // Track API call
    flowTracker.trackAPICall("POST", "/api/generate-questions", {
      prompt,
      demoMode,
    });

    if (!prompt || typeof prompt !== "string") {
      return apiError("Invalid prompt provided", 400);
    }

    // If no-cost mode, return instant mock data
    if (shouldMock) {
      flowTracker.trackDecision(
        "Check demo mode",
        "no-cost",
        "Using mock question generation - zero API costs",
      );

      await mockDelay(100);
      const mockQuestions = mockClarifyingQuestions(prompt);

      flowTracker.trackTiming(
        "Mock question generation",
        Date.now() - startTime,
        startTime,
      );

      return apiResponse({
        questions: mockQuestions,
      });
    }

    // Validate API keys
    const keyValidationError = validateAPIKeys();
    if (keyValidationError) {
      return keyValidationError;
    }

    // Create LLM provider with automatic fallback
    const { provider } = createLLMProvider();

    // Generate clarifying questions
    const result = await generateObject({
      model: provider,
      schema: questionSchema,
      system: QUESTION_GENERATION_SYSTEM_PROMPT,
      prompt: buildQuestionGenerationPrompt(prompt),
      maxRetries: 2,
    });

    flowTracker.trackTiming(
      "Total question generation",
      Date.now() - startTime,
      startTime,
    );

    return apiResponse(result.object);
  } catch (error) {
    console.error("Error generating questions:", error);
    return apiError(
      "Failed to generate questions",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
