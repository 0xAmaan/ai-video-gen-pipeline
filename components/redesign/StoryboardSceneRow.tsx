"use client";

import { StoryboardScene, StoryboardPart as StoryboardPartType } from "@/types/storyboard";
import { StoryboardPart } from "./StoryboardPart";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

interface StoryboardSceneRowProps {
  scene: StoryboardScene;
  selectedPartId: string | null;
  onSceneSelect: () => void;
  onPartSelect: (partId: string) => void;
}

export const StoryboardSceneRow = ({
  scene,
  selectedPartId,
  onSceneSelect,
  onPartSelect,
}: StoryboardSceneRowProps) => {
  return (
    <div className="flex gap-0 mb-4 bg-[#1a1a1a] rounded-xl p-4">
      {/* Scene Selector - Left Side (Square Container) */}
      <div
        onClick={onSceneSelect}
        className={cn(
          "flex-shrink-0 w-[200px] flex flex-col items-center justify-center gap-3 rounded-lg cursor-pointer transition-all mr-4",
          scene.isSelected
            ? "bg-blue-600/20 border-2 border-blue-600"
            : "bg-[#2a2a2a] border-2 border-transparent hover:border-gray-700"
        )}
      >
        <div
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold transition-all",
            scene.isSelected
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/50"
              : "bg-gray-800 text-gray-400"
          )}
        >
          {scene.sceneNumber}
        </div>
        <div className={cn(
          "text-sm font-medium text-center",
          scene.isSelected ? "text-blue-400" : "text-gray-400"
        )}>
          {scene.title}
        </div>
        {scene.isSelected && (
          <div className="text-xs text-blue-400 flex items-center gap-1 bg-blue-600/30 px-3 py-1 rounded-full">
            <Plus className="w-3 h-3" />
            <span>Add Parts</span>
          </div>
        )}
      </div>

      {/* Parts Container - Right Side */}
      <div className="flex-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900">
        <div className="flex gap-4 min-h-[200px] items-center">
          {scene.parts.length === 0 ? (
            <div className="flex items-center justify-center w-full h-[180px] border-2 border-dashed border-gray-700 rounded-xl text-gray-500 text-sm">
              {scene.isSelected
                ? "Use ChatInput below to add parts to this scene"
                : "Select this scene to add parts"}
            </div>
          ) : (
            scene.parts.map((part) => (
              <StoryboardPart
                key={part.id}
                part={part}
                isSelected={selectedPartId === part.id}
                onSelect={() => onPartSelect(part.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};
