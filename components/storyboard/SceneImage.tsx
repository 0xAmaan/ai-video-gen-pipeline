import { Loader2, Sparkles } from "lucide-react";
import type { Scene } from "@/types/scene";

interface SceneImageProps {
  scene: Scene;
  index: number;
  isRegenerating: boolean;
  onRegenerate: () => void;
}

export const SceneImage = ({
  scene,
  index,
  isRegenerating,
  onRegenerate,
}: SceneImageProps) => {
  return (
    <div className="relative w-48 h-27 rounded-lg overflow-hidden bg-accent">
      {scene.image ? (
        <img
          src={scene.image}
          alt={`Scene ${index + 1}`}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          <span className="text-sm">No image</span>
        </div>
      )}
      <button
        onClick={onRegenerate}
        disabled={isRegenerating}
        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        title={isRegenerating ? "Regenerating..." : "Regenerate scene"}
      >
        {isRegenerating ? (
          <Loader2 className="w-4 h-4 text-white animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4 text-white" />
        )}
      </button>
    </div>
  );
};
