"use client";

import { Id } from "@/convex/_generated/dataModel";
import { ProjectScene, SceneShot, ShotSelectionSummary } from "@/lib/types/redesign";
import { useProjectShotSelections } from "@/lib/hooks/useProjectRedesign";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";
import { proxiedImageUrl } from "@/lib/redesign/image-proxy";

interface VerticalMediaGalleryProps {
  projectId?: Id<"videoProjects">;
  scenes?: (ProjectScene & { shots: SceneShot[] })[];
  activeShotId?: Id<"sceneShots"> | null;
  onSelect?: (selection: ShotSelectionSummary) => void;
}

export const VerticalMediaGallery = ({
  projectId,
  scenes,
  activeShotId,
  onSelect,
}: VerticalMediaGalleryProps) => {
  const selections = useProjectShotSelections(projectId);

  if (!projectId || !scenes || scenes.length === 0) {
    return null;
  }

  // Create a map of shotId -> selection for quick lookup
  const selectionMap = new Map(
    selections?.map((sel) => [sel.shot._id, sel]) ?? []
  );

  // Flatten all shots from all scenes and create gallery items
  const galleryItems = scenes.flatMap((scene) =>
    scene.shots.map((shot) => ({
      scene,
      shot,
      selection: selectionMap.get(shot._id),
    }))
  );

  // Sort by scene number, then shot number
  const orderedItems = galleryItems.sort((a, b) => {
    if (a.scene.sceneNumber !== b.scene.sceneNumber) {
      return a.scene.sceneNumber - b.scene.sceneNumber;
    }
    const shotA = a.shot.shotNumber ?? 0;
    const shotB = b.shot.shotNumber ?? 0;
    return shotA - shotB;
  });

  return (
    <aside
      className="sticky top-32 rounded-3xl bg-[#0c0c0c]/90 border border-white/5 shadow-xl shadow-black/40 p-4 space-y-3 max-h-[70vh] overflow-auto scrollbar-hide"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-1">
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2 text-center">
          Master Shots
        </p>
      </div>

      {orderedItems.map((item) => {
        const isActive = activeShotId === item.shot._id;
        const hasSelection = !!item.selection;

        return (
          <div
            key={item.shot._id}
            onClick={() => hasSelection && onSelect?.(item.selection!)}
            className={cn(
              "w-full rounded-2xl overflow-hidden border transition-all",
              hasSelection
                ? "cursor-pointer bg-[#111111] border-white/5 hover:border-blue-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
                : "bg-white/5 border border-white/20",
              isActive && hasSelection && "border-blue-400/60 shadow-lg shadow-blue-500/20",
            )}
          >
            <div className="relative w-full aspect-video overflow-hidden">
              {hasSelection ? (
                <>
                  <img
                    src={proxiedImageUrl(item.selection!.image.imageUrl)}
                    alt={item.shot.description}
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/70" />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5">
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div className="absolute bottom-3 left-3">
                <div className="bg-black/60 backdrop-blur-sm px-2 py-1 rounded">
                  <p className="text-[0.625rem] font-semibold text-white leading-tight">
                    Scene {item.scene.sceneNumber} · Shot {item.shot.shotNumber}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </aside>
  );
};
