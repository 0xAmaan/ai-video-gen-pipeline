"use server";

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { apiError, apiResponse } from "@/lib/api-response";
import { getConvexClient } from "@/lib/server/convex";
import { generateVoiceoverScript } from "@/lib/voiceover-script-generator";
import { getFlowTracker } from "@/lib/flow-tracker";

const buildPrompt = (params: {
  projectPrompt?: string | null;
  projectTitle?: string | null;
  scenes: Array<{
    sceneNumber?: number;
    description?: string | null;
    title?: string | null;
    duration?: number;
  }>;
}) => {
  const lines: string[] = [];
  if (params.projectTitle) {
    lines.push(`Project title: ${params.projectTitle}`);
  }
  if (params.projectPrompt) {
    lines.push(`Project concept: ${params.projectPrompt}`);
  }
  if (params.scenes.length > 0) {
    lines.push("Scenes:");
    params.scenes.forEach((scene, index) => {
      const label =
        typeof scene.sceneNumber === "number"
          ? `Scene ${scene.sceneNumber}`
          : `Scene ${index + 1}`;
      const desc =
        scene.description?.trim() ||
        scene.title?.trim() ||
        "Visual beat without description";
      const duration =
        typeof scene.duration === "number" && Number.isFinite(scene.duration)
          ? `(~${scene.duration.toFixed(0)}s)`
          : "";
      lines.push(`- ${label} ${duration}: ${desc}`);
    });
  }

  lines.push(
    "Write a concise 70-140 word voiceover script for a polished product ad.",
  );
  lines.push(
    "Structure: 1) Hook that names the product once. 2) 1-3 lines that align to the scenes above. 3) Clear CTA.",
  );
  lines.push(
    "Rules: natural sentences, no ellipses, no bullet lists, no truncation markers, do not repeat the same sentence twice, DO NOT prefix with labels like [Voiceover] or 'Voiceover:'. Output only the script sentences.",
  );

  return lines.join("\n");
};

const stripVoiceoverLabel = (text: string) =>
  text.replace(/^\s*\[?\s*voiceover\]?:?\s*/i, "").trim();

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  let projectId: Id<"videoProjects"> | undefined;

  try {
    const body = await req.json();
    projectId = body?.projectId as Id<"videoProjects"> | undefined;

    if (!projectId) {
      return apiError("projectId is required", 400);
    }

    const convex = await getConvexClient();
    const projectData = await convex.query(api.video.getProjectWithAllData, {
      projectId,
    });
    if (!projectData?.project) {
      return apiError("Project not found", 404);
    }

    const scenes = (projectData.scenes ?? []).map((scene) => ({
      sceneNumber: scene.sceneNumber,
      description: scene.description,
      title: scene.title,
      duration: scene.duration,
    }));

    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const prompt = buildPrompt({
      projectPrompt: projectData.project.prompt,
      projectTitle: projectData.project.title ?? projectData.project.name,
      scenes,
    });

    flowTracker.trackAPICall("POST", "/api/generate-voiceover-script", {
      projectId,
      hasOpenAI,
    });

    if (!hasOpenAI) {
      const fallback = generateVoiceoverScript({
        projectPrompt: projectData.project.prompt,
        projectTitle: projectData.project.title ?? projectData.project.name,
        durationSeconds: scenes.reduce(
          (sum, scene) => sum + (scene.duration ?? 0),
          0,
        ),
        scenes: scenes.map((scene) => ({
          sceneNumber: scene.sceneNumber,
          description: scene.description,
          title: scene.title,
          durationSeconds: scene.duration,
        })),
      });

      return apiResponse({
        success: true,
        script: fallback.script,
        provider: "fallback",
      });
    }

    const result = await generateText({
      model: openai("gpt-4o-mini"),
      system:
        "You are an expert creative copywriter for video ads. Deliver scripts that sound human, confident, and concise.",
      prompt,
      temperature: 0.8,
      maxTokens: 260,
    });

    const script = stripVoiceoverLabel(result.text.trim());

    return apiResponse({
      success: true,
      script,
      provider: "openai",
    });
  } catch (error) {
    console.error("generate-voiceover-script error:", error);
    return apiError(
      "Failed to generate voiceover script",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
