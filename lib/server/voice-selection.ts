import "server-only";
import { generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { VOICE_SELECTION_SYSTEM_PROMPT } from "@/lib/prompts";
import {
  MINIMAX_EMOTIONS,
  MINIMAX_VOICE_IDS,
  selectVoiceForPrompt,
} from "@/lib/voice-selection";

export const voiceSelectionSchema = z.object({
  voiceId: z.enum(MINIMAX_VOICE_IDS),
  voiceName: z.string(),
  emotion: z.enum(MINIMAX_EMOTIONS),
  speed: z.number().min(0.5).max(2),
  pitch: z.number().min(-12).max(12),
  reasoning: z.string(),
});

export type VoiceSelectionPayload = z.infer<typeof voiceSelectionSchema>;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export async function generateVoiceSelection(
  prompt: string,
  responses?: Record<string, unknown>,
): Promise<VoiceSelectionPayload> {
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY);
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

  try {
    if (!hasGroqKey && !hasOpenAIKey) {
      throw new Error("No LLM API key configured");
    }

    const model = hasGroqKey ? groq("openai/gpt-oss-20b") : openai("gpt-4o-mini");

    const { object } = await generateObject({
      model,
      schema: voiceSelectionSchema,
      system: VOICE_SELECTION_SYSTEM_PROMPT,
      prompt: `Select the best voice for this video project:\n\nPrompt: ${prompt}\n\nUser preferences: ${JSON.stringify(
        responses ?? {},
      )}`,
      maxRetries: 2,
    });

    return {
      ...object,
      speed: clamp(object.speed ?? 1, 0.8, 1.2),
      pitch: clamp(object.pitch ?? 0, -2, 2),
    };
  } catch (error) {
    console.warn("Voice selection fallback triggered:", error);
    const fallback = selectVoiceForPrompt({ prompt, responses });
    return {
      voiceId: fallback.voiceId,
      voiceName: fallback.voiceName,
      emotion: fallback.emotion,
      speed: clamp(fallback.speed ?? 1, 0.8, 1.2),
      pitch: clamp(fallback.pitch ?? 0, -2, 2),
      reasoning: fallback.reasoning,
    };
  }
}
