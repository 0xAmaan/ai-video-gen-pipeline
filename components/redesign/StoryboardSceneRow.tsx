"use client";

import { StoryboardSceneGroup } from "@/lib/types/redesign";
import { StoryboardPart } from "./StoryboardPart";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";

interface StoryboardSceneRowProps {
  scene: StoryboardSceneGroup;
  isSelected: boolean;
  selectedShotId?: Id<"sceneShots"> | null;
  onSceneSelect: (sceneId: Id<"projectScenes">) => void;
  onShotSelect: (shotId: Id<"sceneShots">) => void;
}

export const StoryboardSceneRow = ({
  scene,
  isSelected,
  selectedShotId,
  onSceneSelect,
  onShotSelect,
}: StoryboardSceneRowProps) => {
  return (
    <div className="flex gap-4 mb-6 bg-[#111111] rounded-3xl p-4 border border-gray-900">
      {/* NOTE: Scene selection functionality is deprecated but preserved for future use */}
      {/* <button
        onClick={() => onSceneSelect(scene.scene._id)}
        className={cn(
          "flex-shrink-0 w-[200px] rounded-2xl border-2 flex flex-col items-center justify-center gap-3 transition-all",
          isSelected
            ? "border-blue-400 bg-blue-500/10"
            : "border-transparent bg-[#1c1c1c] hover:border-gray-700",
        )}
      > */}
      <div
        className={cn(
          "flex-shrink-0 w-[200px] rounded-2xl border-2 flex flex-col items-center justify-center gap-3 transition-all",
          // NOTE: Scene selection styling is deprecated but preserved for future use
          // isSelected
          //   ? "border-emerald-400 bg-emerald-500/10"
          //   : "border-transparent bg-[#1c1c1c] hover:border-gray-700",
          "border-transparent bg-[#1c1c1c]", // Always use neutral styling
        )}
      >
        <div
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold",
            // NOTE: Scene selection circle styling is deprecated but preserved for future use
            // isSelected ? "bg-emerald-500 text-black" : "bg-gray-900 text-gray-300",
            "bg-gray-900 text-gray-300", // Always use neutral styling
          )}
        >
          {scene.scene.sceneNumber}
        </div>
        <div
          className={cn(
            "text-sm font-medium text-center px-3",
            // NOTE: Scene selection text styling is deprecated but preserved for future use
            // isSelected ? "text-emerald-200" : "text-gray-400",
            "text-gray-400", // Always use neutral styling
          )}
        >
          {scene.scene.title}
        </div>
      {/* </button> */}
      </div>

      <div className="flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
        <div className="flex gap-4 min-h-[200px] items-center pl-2">
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
                onSelect={onShotSelect}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
