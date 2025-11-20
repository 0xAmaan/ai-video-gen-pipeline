"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompleteProject, useRedesignProject } from "@/lib/hooks/useProjectRedesign";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { requestPreviewSeed } from "@/lib/client/requestPreviewSeed";

const PREVIEW_PLACEHOLDERS = [
  {
    title: "Calibrating scenes",
    description: "Mapping your idea into cinematic beats",
  },
  {
    title: "Building shots",
    description: "Picking the right camera moves and pacing",
  },
  {
    title: "Preparing references",
    description: "Making sure brand assets are queued up",
  },
];

const useRotatingScenes = (titles: { title: string; description: string }[], delay = 2500) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (titles.length === 0) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % titles.length);
    }, delay);
    return () => clearInterval(interval);
  }, [titles, delay]);

  return titles.length ? titles[index] : null;
};

const LoadingPage = () => {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params?.projectId as Id<"videoProjects"> | undefined;

  const project = useRedesignProject(projectId);
  const completeData = useCompleteProject(projectId);
  const [seedState, setSeedState] = useState<"idle" | "running" | "error" | "complete">("idle");
  const [seedSummary, setSeedSummary] = useState<{
    requested: number;
    completed: number;
    failures: Array<{ shotId: string; reason: string }>;
    alreadyComplete?: boolean;
  } | null>(null);

  const scenes = completeData?.scenes ?? [];
  const totalShots = useMemo(
    () => scenes.reduce((sum, scene) => sum + scene.shots.length, 0),
    [scenes],
  );
  const shotsWithImages = useMemo(
    () =>
      scenes.reduce(
        (sum, scene) =>
          sum + scene.shots.filter((shot) => shot.images && shot.images.length > 0).length,
        0,
      ),
    [scenes],
  );

  const scenesReady = scenes.length > 0;
  const previewsReady = totalShots > 0 && shotsWithImages === totalShots;
  const previewScenes = scenesReady
    ? scenes.map((scene) => ({
        title: scene.title || `Scene ${scene.sceneNumber}`,
        description: scene.description,
      }))
    : PREVIEW_PLACEHOLDERS;

  const activePreview = useRotatingScenes(previewScenes);

  const runSeeding = async () => {
    if (!projectId) return;
    setSeedState("running");
    try {
      const summary = await requestPreviewSeed(projectId);
      setSeedSummary(summary);
      if (!summary.success) {
        setSeedState("error");
      } else {
        setSeedState("complete");
      }
    } catch (error) {
      console.error("Failed to seed shot previews", error);
      setSeedState("error");
    }
  };

  useEffect(() => {
    if (!projectId || !scenesReady || previewsReady || seedState !== "idle") return;
    void runSeeding();
  }, [projectId, scenesReady, previewsReady, seedState]);

  useEffect(() => {
    if (!projectId || !previewsReady) return;
    const timeout = setTimeout(() => {
      router.push(`/project-redesign/${projectId}/scene-planner`);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [previewsReady, router, projectId]);

  const progress = previewsReady
    ? 100
    : totalShots > 0
    ? Math.round((shotsWithImages / totalShots) * 100)
    : scenesReady
    ? 25
    : 5;

  const statusItems = [
    {
      label: "Structuring scenes",
      complete: scenesReady,
      description: scenesReady
        ? `Generated ${scenes.length} ${scenes.length === 1 ? "scene" : "scenes"}`
        : "Turning your idea into a coherent story arc",
    },
    {
      label: "Rendering preview frames",
      complete: previewsReady,
      description: previewsReady
        ? "Every shot now has a visual preview"
        : "Creating 4 images per shot so you can pick favorites",
    },
  ];

  return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-3xl w-full space-y-10 text-center">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-gray-500">
              Preparing your project
            </p>
            <h1 className="text-4xl font-semibold mt-3">
              {project?.title || "Shaping your commercial"}
            </h1>
            <p className="text-gray-400 mt-3">
              Sit tight. We&apos;re breaking your idea into scenes and rendering preview frames
              so you can start picking shots instantly.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>Overall progress</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-8 space-y-4">
              {statusItems.map((status) => (
                <div
                  key={status.label}
                  className="flex items-center justify-between bg-black/30 border border-white/5 rounded-2xl px-4 py-3"
                >
                  <div className="text-left">
                    <p className="font-medium">{status.label}</p>
                    <p className="text-xs text-gray-500">{status.description}</p>
                  </div>
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full border",
                      status.complete
                        ? "bg-emerald-400 border-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                        : "border-gray-600",
                    )}
                  />
                </div>
              ))}
            </div>
          </div>

          {activePreview && (
            <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-3xl p-6">
              <p className="text-xs uppercase tracking-[0.4em] text-gray-500">
                Scene preview
              </p>
              <h2 className="text-2xl font-semibold mt-2">{activePreview.title}</h2>
              <p className="text-gray-400 mt-2">{activePreview.description}</p>
              <div className="mt-6 h-40 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center">
                <div className="flex items-center gap-3 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {previewsReady
                    ? "All previews ready — redirecting..."
                    : "Rendering preview frames..."}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            <Button
              disabled={!projectId}
              onClick={() => router.push(`/project-redesign/${projectId}/scene-planner`)}
              variant="outline"
              className="w-full sm:w-auto border-white/30 text-white hover:bg-white/10"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Skip to planner
            </Button>
            {seedState === "error" && (
              <div className="text-xs text-red-400 flex flex-col items-center gap-2">
                <p>Some previews failed to render.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-400/40 text-red-200 hover:bg-red-500/10"
                  onClick={() => runSeeding()}
                >
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Retry preview generation
                </Button>
                {seedSummary?.failures?.length ? (
                  <p className="text-[11px] text-red-300">
                    Example error: {seedSummary.failures[0].reason}
                  </p>
                ) : null}
              </div>
            )}
            <p className="text-xs text-gray-500 text-center">
              This screen closes automatically once preview frames finish rendering.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingPage;
