"use client";

import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface StoryboardPartProps {
  shotId: Id<"sceneShots">;
  shotNumber: number;
  prompt: string;
  imageUrl?: string | null;
  isSelected?: boolean;
  onSelect?: (shotId: Id<"sceneShots">) => void;
}

export const StoryboardPart = ({
  shotId,
  shotNumber,
  prompt,
  imageUrl,
  isSelected,
  onSelect,
}: StoryboardPartProps) => {
  return (
    <div
      // NOTE: Shot selection functionality is deprecated but preserved for future use
      // onClick={() => onSelect?.(shotId)}
      className={cn(
        "relative flex-shrink-0 w-[280px] h-[180px] rounded-2xl overflow-hidden transition-all border-2",
        // NOTE: Shot selection styling is deprecated but preserved for future use
        // isSelected
        //   ? "border-emerald-400 shadow-lg shadow-emerald-500/20 scale-[1.02]"
        //   : "border-gray-700 hover:border-gray-500 cursor-pointer",
        "border-gray-700", // Always use neutral border
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={prompt}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-[#0f0f0f] flex items-center justify-center text-gray-600 text-sm">
          No image selected
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent px-3 py-3 flex flex-col justify-end gap-2">
        <div className="text-xs uppercase tracking-wider text-gray-300">
          Shot {shotNumber}
        </div>
        <p className="text-xs text-gray-200 line-clamp-2">{prompt}</p>
      </div>

      {/* NOTE: Shot selection badge is deprecated but preserved for future use */}
      {/* isSelected && (
        <div className="absolute top-2 right-2 bg-emerald-500 text-black text-xs px-2 py-1 rounded-full font-semibold">
          Selected
        </div>
      ) */}
    </div>
  );
};
