"use client";

import { StoryboardSceneGroup } from "@/lib/types/redesign";
import { StoryboardPart } from "./StoryboardPart";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw } from "lucide-react";

const getLegacySceneId = (shotId?: Id<"sceneShots">) => {
  if (!shotId) {
    return undefined;
  }
  // Legacy scenes store redesignShotId, so we can reference by shot.
  return shotId;
};

interface StoryboardSceneRowProps {
  scene: StoryboardSceneGroup;
  selectedShotId?: Id<"sceneShots"> | null;
  onShotSelect: (shotId: Id<"sceneShots">) => void;
  clips?: Array<{
    _id: Id<"videoClips">;
    sceneId: Id<"scenes">;
    status: string;
    videoUrl?: string | null;
    errorMessage?: string | null;
  }>;
  convexScenes?: Array<{
    _id: Id<"scenes">;
    redesignShotId?: Id<"sceneShots">;
    imageUrl?: string;
    description?: string;
    visualPrompt?: string;
    sceneNumber?: number;
    duration?: number;
  }>;
  isGenerating?: boolean;
  isLocked?: boolean;
  onRetryClip?: (clipId: Id<"videoClips">, sceneId: Id<"scenes">) => void;
}

export const StoryboardSceneRow = ({
  scene,
  selectedShotId,
  onShotSelect,
  clips = [],
  convexScenes = [],
  isGenerating = false,
  isLocked = false,
  onRetryClip,
}: StoryboardSceneRowProps) => {
  const router = useRouter();

  const handleGenerateClip = (shotId: Id<"sceneShots">) => {
    console.log("[StoryboardSceneRow] Generate clip clicked", {
      shotId,
      sceneId: scene.scene._id,
      projectId: scene.scene.projectId,
    });
    const legacySceneId = getLegacySceneId(shotId);
    router.push(`/${scene.scene.projectId}/video?shot=${legacySceneId}`);
  };

  // Helper to get clip for a shot (via legacy scene mapping)
  const getClipForShot = (shotId: Id<"sceneShots">) => {
    // Step 1: Find the legacy scene with redesignShotId === shotId
    const legacyScene = convexScenes.find((s) => s.redesignShotId === shotId);
    if (!legacyScene) {
      return null;
    }

    // Step 2: Find the clip with sceneId === legacyScene._id
    return clips.find((clip) => clip.sceneId === legacyScene._id) || null;
  };

  return (
    <div className="flex gap-4 mb-6 bg-[#111111] rounded-3xl p-4 border border-gray-900">
      <div className="flex-shrink-0 w-[200px] rounded-2xl border-2 border-transparent bg-[#1c1c1c] flex flex-col items-center justify-center gap-3">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold bg-gray-900 text-gray-300">
          {scene.scene.sceneNumber}
        </div>
        <div className="text-sm font-medium text-center px-3 text-gray-400">
          {scene.scene.title}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
        {/* Images row */}
        <div className="flex gap-4 min-h-[200px] items-center mb-4">
          {scene.shots.length === 0 ? (
            <div className="flex-1 h-[180px] border border-dashed border-gray-700 rounded-2xl flex items-center justify-center text-gray-500 text-sm">
              Awaiting selections for this scene.
            </div>
          ) : (
            scene.shots.map((shotWrapper) => (
              <StoryboardPart
                key={shotWrapper.shot._id}
                shotId={shotWrapper.shot._id}
                shotNumber={shotWrapper.shot.shotNumber}
                prompt={shotWrapper.shot.description}
                imageUrl={shotWrapper.selectedImage?.imageUrl}
                isSelected={selectedShotId === shotWrapper.shot._id}
                onSelect={isLocked ? undefined : onShotSelect}
                onAction={() => handleGenerateClip(shotWrapper.shot._id)}
                isLocked={isLocked}
              />
            ))
          )}
        </div>

        {/* Videos row - shown below images */}
        {scene.shots.length > 0 && (clips.length > 0 || isGenerating) && (
          <div className="flex gap-4 items-center">
            {scene.shots.map((shotWrapper) => {
              // Find clip for this shot using the helper function
              const clip = getClipForShot(shotWrapper.shot._id);
              const isSelected = selectedShotId === shotWrapper.shot._id;
              const handleVideoSelection = () => {
                onShotSelect?.(shotWrapper.shot._id);
              };

              const showVideo = clip && clip.status === "complete" && clip.videoUrl;
              const showSkeleton = (isGenerating && !clip) || (clip && (clip.status === "processing" || clip.status === "pending"));
              const showError = clip && clip.status === "failed";

              // Don't show anything if no clip and not generating
              if (!clip && !isGenerating) {
                return null;
              }

              return (
                <div
                  key={`video-${shotWrapper.shot._id}`}
                  className={cn(
                    "flex-shrink-0 w-[280px] rounded-2xl border transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
                    isSelected
                      ? "border-emerald-400/60 shadow-lg shadow-emerald-500/15"
                      : "border-transparent hover:border-emerald-400/30",
                  )}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={handleVideoSelection}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleVideoSelection();
                    }
                  }}
                  data-storyboard-selection-target="true"
                >
                  {showVideo && clip.videoUrl && (
                    <div className="rounded-2xl overflow-hidden border border-transparent">
                      <video
                        src={clip.videoUrl}
                        controls
                        className="w-full h-auto bg-black"
                        playsInline
                      />
                      <div className="bg-gray-900 px-3 py-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-green-400">Shot {shotWrapper.shot.shotNumber} - Complete</p>
                        <button
                          type="button"
                          className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition"
                          title="Regenerate video"
                          aria-label={`Regenerate video for shot ${shotWrapper.shot.shotNumber}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            event.preventDefault();
                            if (onRetryClip && clip) {
                              onRetryClip(clip._id, clip.sceneId);
                            }
                          }}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {showSkeleton && (
                    <div className="space-y-2 p-2">
                      <Skeleton className="w-full h-[180px] rounded-2xl bg-gray-800 animate-pulse" />
                      <div className="px-2">
                        <p className="text-xs text-gray-400">
                          {clip?.status === "processing" ? "Generating video..." : "Queued for generation..."}
                        </p>
                      </div>
                    </div>
                  )}

                  {showError && (
                    <div className="h-[180px] rounded-2xl border border-red-900 bg-red-950/20 flex flex-col items-center justify-center p-4">
                      <p className="text-xs text-red-400 text-center mb-2">
                        {clip.errorMessage || "Video generation failed"}
                      </p>
                      <button
                        className="text-xs text-white bg-red-800 hover:bg-red-700 px-3 py-1 rounded-full transition cursor-pointer"
                        onClick={() => {
                          if (onRetryClip && clip) {
                            console.log("Retry clicked for shot", shotWrapper.shot._id, "clip", clip._id);
                            onRetryClip(clip._id, clip.sceneId);
                          }
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
