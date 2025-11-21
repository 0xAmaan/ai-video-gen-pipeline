"use client";

import { Id } from "@/convex/_generated/dataModel";

interface StoryboardPartProps {
  shotId: Id<"sceneShots">;
  shotNumber: number;
  prompt: string;
  imageUrl?: string | null;
}

export const StoryboardPart = ({
  shotNumber,
  prompt,
  imageUrl,
}: StoryboardPartProps) => {
  return (
    <div className="relative flex-shrink-0 w-[280px] h-[180px] rounded-2xl overflow-hidden border-2 border-gray-700">
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
    </div>
  );
};
