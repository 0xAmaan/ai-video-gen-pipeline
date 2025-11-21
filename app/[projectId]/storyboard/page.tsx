"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageNavigation } from "@/components/redesign/PageNavigation";
import { StoryboardSceneRow } from "@/components/redesign/StoryboardSceneRow";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Film } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useStoryboardRows, useAllMasterShotsSet } from "@/lib/hooks/useProjectRedesign";

const StoryboardPage = () => {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params?.projectId as Id<"videoProjects"> | undefined;
  const storyboardRows = useStoryboardRows(projectId);
  const allMasterShotsSet = useAllMasterShotsSet(projectId);
  const [isPromoting, setIsPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!projectId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Missing project context.
      </div>
    );
  }

  const hasRows = !!storyboardRows && storyboardRows.length > 0;

  // Don't lock storyboard when we're already on this page
  // (only lock it when viewing from other pages)
  const lockMessage = !allMasterShotsSet
    ? "Set up master shots for all scenes in Scene Planner"
    : undefined;

  const handleGenerateVideo = async () => {
    if (!projectId) return;
    setIsPromoting(true);
    setError(null);
    try {
      const response = await fetch("/api/promote-storyboard-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to promote scenes");
      }
      router.push(`/${projectId}/video`);
    } catch (err) {
      console.error("Failed to generate video clips", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsPromoting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-sm border-b border-gray-900 px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">
              Storyboard
            </p>
            <h1 className="text-2xl font-bold">Selected master shots</h1>
            <p className="text-sm text-gray-400 mt-1">
              Review each scene&apos;s chosen frames before animation.
            </p>
          </div>

          <PageNavigation
            projectId={projectId}
            storyboardLocked={false}
            storyboardLockMessage={lockMessage}
          />

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-gray-700 text-gray-200 hover:bg-gray-800"
              onClick={() => router.push(`/${projectId}/scene-planner`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Planner
            </Button>
            <Button
              onClick={handleGenerateVideo}
              disabled={!hasRows || isPromoting}
              className="bg-white text-black hover:bg-gray-200 flex items-center gap-2"
            >
              <Film className="w-4 h-4" />
              {isPromoting ? "Preparing scenes..." : "Generate video"}
            </Button>
          </div>
        </div>
        {error && (
          <div className="text-sm text-red-400 mt-2">
            {error}
          </div>
        )}
      </div>

      <div className="px-8 py-8 space-y-4">
        {!storyboardRows ? (
          <div className="text-gray-500 text-center py-20 border border-dashed border-gray-800 rounded-3xl">
            Loading storyboard...
          </div>
        ) : !hasRows ? (
          <div className="text-gray-500 text-center py-20 border border-dashed border-gray-800 rounded-3xl">
            No storyboard selections yet. Select master shots in the iterator to
            populate this view.
          </div>
        ) : (
          storyboardRows.map((row) => (
            <StoryboardSceneRow
              key={row.scene._id}
              scene={row}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default StoryboardPage;
