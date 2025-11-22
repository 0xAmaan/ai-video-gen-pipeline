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
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const StoryboardPage = () => {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params?.projectId as Id<"videoProjects"> | undefined;
  const storyboardRows = useStoryboardRows(projectId);
  const allMasterShotsSet = useAllMasterShotsSet(projectId);
  const projectProgress = useProjectProgress(projectId);
  const selectionsComplete = Boolean(projectProgress?.isSelectionComplete);
  const syncShotToLegacyScene = useSyncShotToLegacyScene();
  const clearVideoClips = useMutation(api.video.clearVideoClips);
  const syncedShotIds = useRef<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const canGenerateVideo = Boolean(projectId) && selectionsComplete && !isSyncing;

  if (typeof window !== "undefined") {
    console.log("[StoryboardPage] projectId", projectId);
    console.log("[StoryboardPage] projectProgress", projectProgress);
    console.log("[StoryboardPage] storyboardRows", storyboardRows);
    console.log("[StoryboardPage] selectionsComplete", selectionsComplete);
    console.log("[StoryboardPage] isSyncing", isSyncing);
  }

  const [selectedShotId, setSelectedShotId] = useState<Id<"sceneShots"> | null>(
    null,
  );

  useEffect(() => {
    if (!storyboardRows || !projectId) return;

    const syncAllShots = async () => {
      const shotsToSync: Array<{
        projectId: Id<"videoProjects">;
        sceneId: Id<"projectScenes">;
        shotId: Id<"sceneShots">;
        selectedImageId: Id<"shotImages">;
      }> = [];

      // Collect all shots that need syncing
      console.log("[TRACE] Starting shot collection for sync", {
        rowCount: storyboardRows.length,
      });

      storyboardRows.forEach((row, rowIndex) => {
        console.log(`[TRACE] Row ${rowIndex}: scene ${row.scene.sceneNumber}`, {
          shotCount: row.shots.length,
        });

        row.shots.forEach((shotWrapper, shotIndex) => {
          console.log(`[TRACE] Row ${rowIndex}, Shot ${shotIndex}:`, {
            shotId: shotWrapper.shot._id,
            shotNumber: shotWrapper.shot.shotNumber,
            hasSelectedImage: !!shotWrapper.selectedImage,
            selectedImageId: shotWrapper.selectedImage?._id,
            imageUrl: shotWrapper.selectedImage?.imageUrl,
          });

          if (!shotWrapper.selectedImage) {
            console.warn(`[TRACE] Shot ${shotWrapper.shot._id} has NO selectedImage - SKIPPING SYNC`);
            return;
          }

          const shotId = shotWrapper.shot._id;
          if (syncedShotIds.current.has(shotId)) {
            console.log(`[TRACE] Shot ${shotId} already synced - SKIPPING`);
            return;
          }

          const syncItem = {
            projectId,
            sceneId: row.scene._id,
            shotId,
            selectedImageId: shotWrapper.selectedImage._id,
          };

          console.log(`[TRACE] Adding shot to sync queue:`, {
            ...syncItem,
            imageUrl: shotWrapper.selectedImage.imageUrl,
            storageId: shotWrapper.selectedImage.storageId,
            FULL_IMAGE_OBJECT: shotWrapper.selectedImage,
          });

          shotsToSync.push(syncItem);
        });
      });

      console.log("[TRACE] Shot collection complete", {
        totalToSync: shotsToSync.length,
        shotsData: shotsToSync,
      });

      if (shotsToSync.length === 0) {
        console.log("[TRACE] No shots to sync - exiting");
        return;
      }

      setIsSyncing(true);
      console.log("[StoryboardPage] Starting sync of", shotsToSync.length, "shots");

      try {
        // Sync all shots in parallel and wait for all to complete
        await Promise.all(
          shotsToSync.map(async (syncData, index) => {
            try {
              syncedShotIds.current.add(syncData.shotId);
              console.log(`[TRACE] Syncing shot ${index + 1}/${shotsToSync.length}:`, syncData);
              await syncShotToLegacyScene(syncData);
              console.log(`[TRACE] ✓ Shot ${index + 1} synced successfully`);
            } catch (error) {
              console.error(`[TRACE] ✗ Shot ${index + 1} sync FAILED:`, error);
              syncedShotIds.current.delete(syncData.shotId);
              throw error;
            }
          })
        );
        console.log("[TRACE] ✓✓✓ ALL SHOTS SYNCED SUCCESSFULLY ✓✓✓");
      } catch (error) {
        console.error("[TRACE] ✗✗✗ SHOT SYNC ERROR ✗✗✗", error);
      } finally {
        setIsSyncing(false);
      }
    };

    syncAllShots();
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
            videoLocked={!selectionsComplete || isSyncing}
            videoLockMessage={
              isSyncing
                ? "Preparing scenes for video generation..."
                : "Select master shots for every scene to unlock video generation"
            }
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
              onClick={async () => {
                console.log("[StoryboardPage] Generate Video clicked", {
                  projectId,
                  canGenerateVideo,
                  selectionsComplete,
                  isSyncing,
                });

                // Wait for any ongoing sync to complete before navigating
                if (isSyncing) {
                  console.log("[StoryboardPage] Waiting for sync to complete...");
                  return;
                }

                // Clear old video clips before navigating
                if (projectId) {
                  console.log("[StoryboardPage] Clearing old video clips...");
                  try {
                    const clearedCount = await clearVideoClips({ projectId });
                    console.log(`[StoryboardPage] Cleared ${clearedCount} old clips`);
                  } catch (error) {
                    console.error("[StoryboardPage] Failed to clear clips:", error);
                  }
                }

                projectId && router.push(`/${projectId}/video`);
              }}
            >
              {isSyncing ? "Preparing..." : "Generate Video"}
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
              selectedShotId={selectedShotId}
              onShotSelect={(shotId) => setSelectedShotId(shotId)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default StoryboardPage;
