"use client";

import { Id } from "@/convex/_generated/dataModel";
import { ShotSelectionSummary } from "@/lib/types/redesign";
import { useProjectShotSelections } from "@/lib/hooks/useProjectRedesign";
import { cn } from "@/lib/utils";

interface VerticalMediaGalleryProps {
  projectId?: Id<"videoProjects">;
  activeShotId?: Id<"sceneShots"> | null;
  onSelect?: (selection: ShotSelectionSummary) => void;
}

export const VerticalMediaGallery = ({
  projectId,
  activeShotId,
  onSelect,
}: VerticalMediaGalleryProps) => {
  const selections = useProjectShotSelections(projectId);

  if (!projectId || !selections || selections.length === 0) {
    return null;
  }

  const orderedSelections = [...selections].sort((a, b) => {
    if (a.scene.sceneNumber !== b.scene.sceneNumber) {
      return a.scene.sceneNumber - b.scene.sceneNumber;
    }
    const shotA = a.shot.shotNumber ?? 0;
    const shotB = b.shot.shotNumber ?? 0;
    return shotA - shotB;
  });

  return (
    <aside className="sticky top-32 rounded-3xl bg-[#0c0c0c]/90 border border-white/5 shadow-xl shadow-black/40 p-4 space-y-3 max-h-[70vh] overflow-auto">
      <div className="px-1">
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">
          Selected Shots
        </p>
        <p className="text-sm text-gray-400">
          Tap a thumbnail to jump to that shot
        </p>
      </div>

      {orderedSelections.map((selection) => {
        const isActive = activeShotId === selection.shot._id;
        return (
          <button
            key={selection.selection._id}
            onClick={() => onSelect?.(selection)}
            className={cn(
              "w-full flex flex-col gap-2 rounded-2xl overflow-hidden border transition-all cursor-pointer text-left",
              "bg-[#111111] border-white/5 hover:border-emerald-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50",
              isActive && "border-emerald-400/60 shadow-lg shadow-emerald-500/20",
            )}
          >
            <div className="relative w-full aspect-video overflow-hidden">
              <img
                src={selection.image.imageUrl}
                alt={selection.shot.description}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/70" />
            </div>

            <div className="px-3 pb-3 space-y-1">
              <p className="text-xs font-semibold text-gray-300">
                Scene {selection.scene.sceneNumber} · Shot{" "}
                {selection.shot.shotNumber}
              </p>
              <p className="text-xs text-gray-500 line-clamp-2">
                {selection.shot.description}
              </p>
            </div>
          </button>
        );
      })}
    </aside>
  );
};
