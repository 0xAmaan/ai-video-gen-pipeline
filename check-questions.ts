/**
 * Debug script to check what questions GPT-4o-mini is actually generating
 * Run with: npx tsx check-questions.ts
 */

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import {
  QUESTION_GENERATION_SYSTEM_PROMPT,
  buildQuestionGenerationPrompt,
} from "./lib/prompts";

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

async function testQuestionGeneration(prompt: string) {
  console.log(`\n🧪 Testing question generation for: "${prompt}"\n`);

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: questionSchema,
    system: QUESTION_GENERATION_SYSTEM_PROMPT,
    prompt: buildQuestionGenerationPrompt(prompt),
  });

  console.log("📋 Generated Questions:\n");
  object.questions.forEach((q, idx) => {
    console.log(`${idx + 1}. ID: ${q.id}`);
    console.log(`   Question: ${q.question}`);
    console.log(`   Options: ${q.options.map((o) => o.value).join(", ")}`);
  });

  const hasImagePriority = object.questions.some(
    (q) => q.id === "image-generation-priority",
  );

  console.log("\n" + "=".repeat(80));
  if (hasImagePriority) {
    console.log("✅ 'image-generation-priority' question WAS generated");
  } else {
    console.log("❌ 'image-generation-priority' question was NOT generated");
    console.log("   Model selection will use fallback inference from other questions");
  }
  console.log("=".repeat(80) + "\n");

  return object;
}

// Test with one prompt
(async () => {
  await testQuestionGeneration("A product demo video for our new AI assistant");
})();
