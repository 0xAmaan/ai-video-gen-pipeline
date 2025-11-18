"use client";

import { StoryboardPart as StoryboardPartType } from "@/types/storyboard";
import { cn } from "@/lib/utils";

interface StoryboardPartProps {
  part: StoryboardPartType;
  isSelected: boolean;
  onSelect: () => void;
}

export const StoryboardPart = ({
  part,
  isSelected,
  onSelect,
}: StoryboardPartProps) => {
  return (
    <div
      className={cn(
        "relative flex-shrink-0 w-[280px] h-[180px] rounded-xl overflow-hidden cursor-pointer transition-all",
        "border-2",
        isSelected
          ? "border-white shadow-lg shadow-white/20 scale-[1.02]"
          : "border-gray-700 hover:border-gray-500"
      )}
      onClick={onSelect}
    >
      {/* Image */}
      <img
        src={part.image}
        alt={part.prompt}
        className="w-full h-full object-cover"
      />

      {/* Always visible overlay with buttons */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end justify-between px-3 pb-4">
        <button
          className="px-3 py-1.5 bg-[#1e3a5f] hover:bg-[#2a4a75] text-[#60a5fa] text-xs rounded-lg transition-colors font-medium cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Handle edit image
          }}
        >
          Edit Image
        </button>
        <button
          className="px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 text-xs rounded-lg transition-colors font-medium cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Handle generate video
          }}
        >
          Generate Video
        </button>
      </div>

      {/* Part number indicator */}
      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
        {part.partNumber}
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 bg-white text-black text-xs px-2 py-1 rounded font-medium">
          Selected
        </div>
      )}
    </div>
  );
};
