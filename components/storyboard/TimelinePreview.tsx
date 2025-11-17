import { Card } from "@/components/ui/card";
import type { Scene } from "@/types/scene";

interface TimelinePreviewProps {
  scenes: Scene[];
  totalDuration: number;
}

export const TimelinePreview = ({
  scenes,
  totalDuration,
}: TimelinePreviewProps) => {
  return (
    <Card className="p-6 mb-8">
      <h3 className="text-sm font-semibold mb-4">Timeline Preview</h3>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {scenes.map((scene, index) => {
          const widthPercent = (scene.duration / totalDuration) * 100;
          return (
            <div
              key={scene.id}
              style={{ width: `${Math.max(widthPercent, 10)}%` }}
              className="relative shrink-0 h-16 rounded overflow-hidden border-2 border-border hover:border-primary transition-colors cursor-pointer"
              title={`Scene ${index + 1} - ${scene.duration}s`}
            >
              {scene.image ? (
                <img
                  src={scene.image}
                  alt={`Scene ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-accent flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">
                    No image
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent flex items-end p-1">
                <span className="text-white text-xs font-medium">
                  {scene.duration}s
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
