"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageNavigation } from "@/components/redesign/PageNavigation";
import { StoryboardSceneRow } from "@/components/redesign/StoryboardSceneRow";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import {
  useStoryboardRows,
  useAllMasterShotsSet,
  useProjectProgress,
  useSyncShotToLegacyScene,
} from "@/lib/hooks/useProjectRedesign";

const StoryboardPage = () => {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params?.projectId as Id<"videoProjects"> | undefined;
  const storyboardRows = useStoryboardRows(projectId);
  const allMasterShotsSet = useAllMasterShotsSet(projectId);
  const projectProgress = useProjectProgress(projectId);
  const selectionsComplete = Boolean(projectProgress?.isSelectionComplete);
  const canGenerateVideo = Boolean(projectId) && selectionsComplete;
  const syncShotToLegacyScene = useSyncShotToLegacyScene();
  const syncedShotIds = useRef<Set<string>>(new Set());

  if (typeof window !== "undefined") {
    console.log("[StoryboardPage] projectId", projectId);
    console.log("[StoryboardPage] projectProgress", projectProgress);
    console.log("[StoryboardPage] storyboardRows", storyboardRows);
    console.log("[StoryboardPage] selectionsComplete", selectionsComplete);
  }

  const [selectedSceneId, setSelectedSceneId] = useState<
    Id<"projectScenes"> | null
  >(null);
  const [selectedShotId, setSelectedShotId] = useState<
    Id<"sceneShots"> | null
  >(null);

  useEffect(() => {
    if (storyboardRows && storyboardRows.length > 0) {
      setSelectedSceneId((prev) => prev ?? storyboardRows[0].scene._id);
    }
  }, [storyboardRows]);

  useEffect(() => {
    if (!storyboardRows || !projectId) return;

    storyboardRows.forEach((row) => {
      row.shots.forEach((shotWrapper) => {
        if (!shotWrapper.selectedImage) return;
        const shotId = shotWrapper.shot._id;
        if (syncedShotIds.current.has(shotId)) return;

        syncedShotIds.current.add(shotId);
        console.log("[StoryboardPage] Syncing shot to legacy scene", {
          projectId,
          sceneId: row.scene._id,
          shotId,
          imageId: shotWrapper.selectedImage._id,
        });

        syncShotToLegacyScene({
          projectId,
          sceneId: row.scene._id,
          shotId,
          selectedImageId: shotWrapper.selectedImage._id,
        }).catch((error) => {
          console.error("[StoryboardPage] Failed syncing shot", error);
          syncedShotIds.current.delete(shotId);
        });
      });
    });
  }, [storyboardRows, projectId, syncShotToLegacyScene]);

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
            videoLocked={!selectionsComplete}
            videoLockMessage="Select master shots for every scene to unlock video generation"
            editorLocked={projectProgress?.projectStatus !== "video_generated"}
            editorLockMessage="Generate video clips before editing"
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
              className="bg-white text-black hover:bg-gray-200"
              disabled={!canGenerateVideo}
              onClick={() => {
                console.log("[StoryboardPage] Generate Video clicked", {
                  projectId,
                  canGenerateVideo,
                  selectionsComplete,
                });
                projectId && router.push(`/${projectId}/video`);
              }}
            >
              Generate Video
            </Button>
          </div>
        </div>
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
              isSelected={selectedSceneId === row.scene._id}
              selectedShotId={selectedShotId}
              onSceneSelect={(sceneId) => setSelectedSceneId(sceneId)}
              onShotSelect={(shotId) => setSelectedShotId(shotId)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default StoryboardPage;
