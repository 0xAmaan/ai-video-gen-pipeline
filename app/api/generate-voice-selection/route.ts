import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/server/convex";
import { generateVoiceSelection } from "@/lib/server/voice-selection";
import { selectVoiceForPrompt } from "@/lib/voice-selection";

export async function POST(req: Request) {
  let promptInput = "";
  let responsesInput: Record<string, unknown> | undefined;
  try {
    const { projectId, prompt, responses } = await req.json();
    promptInput = typeof prompt === "string" ? prompt : "";
    responsesInput = responses;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
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

    return NextResponse.json({
      success: true,
      ...selection,
    });
  } catch (error) {
    console.error("Failed to generate voice selection:", error);
    const fallback = selectVoiceForPrompt({
      prompt: promptInput,
      responses: responsesInput,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to select voice",
        fallbackVoice: fallback,
      },
      { status: 500 },
    );
  }
}
