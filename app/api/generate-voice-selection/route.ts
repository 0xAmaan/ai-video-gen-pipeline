import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/server/convex";
import { generateVoiceSelection } from "@/lib/server/voice-selection";
import { selectVoiceForPrompt } from "@/lib/voice-selection";
import { apiResponse, apiError } from "@/lib/api-response";

export async function POST(req: Request) {
  let promptInput = "";
  let responsesInput: Record<string, unknown> | undefined;
  try {
    const { projectId, prompt, responses } = await req.json();
    promptInput = typeof prompt === "string" ? prompt : "";
    responsesInput = responses;

    if (!projectId || typeof projectId !== "string") {
      return apiError("projectId is required", 400);
    }

    if (!prompt || typeof prompt !== "string") {
      return apiError("prompt is required", 400);
    }

    const selection = await generateVoiceSelection(prompt, responses);

    const convex = await getConvexClient();

    await convex.mutation(api.video.saveProjectVoiceSettings, {
      projectId: projectId as Id<"videoProjects">,
      selectedVoiceId: selection.voiceId,
      selectedVoiceName: selection.voiceName,
      voiceReasoning: selection.reasoning,
      emotion: selection.emotion,
      speed: selection.speed,
      pitch: selection.pitch,
    });

    return apiResponse({
      success: true,
      ...selection,
    });
  } catch (error) {
    console.error("Failed to generate voice selection:", error);
    const fallback = selectVoiceForPrompt({
      prompt: promptInput,
      responses: responsesInput,
    });
    return apiError(
      "Failed to select voice",
      500,
      { fallbackVoice: fallback },
    );
  }
}
