import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { GripVertical, Trash2, Loader2, Sparkles } from "lucide-react";
import type { Scene } from "@/types/scene";
import { SceneImage } from "./SceneImage";
import { NarrationControls } from "./NarrationControls";

interface SceneCardProps {
  scene: Scene;
  index: number;
  draggedIndex: number | null;
  isRegenerating: boolean;
  isAudioGenerating: boolean;
  currentVoiceLabel: string;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  onRegenerateScene: (id: string) => void;
  onDescriptionChange: (id: string, description: string) => void;
  onDurationChange: (id: string, duration: number) => void;
  onDeleteScene: (id: string) => void;
  onRegenerateNarration: (id: string) => void;
  onRegenerateNarrationWithText: (id: string) => void;
  onNarrationTextChange: (id: string, text: string) => void;
  onShowVoiceDialog: () => void;
  canDelete: boolean;
  projectId: string | null;
}

export const SceneCard = ({
  scene,
  index,
  draggedIndex,
  isRegenerating,
  isAudioGenerating,
  currentVoiceLabel,
  onDragStart,
  onDragOver,
  onDragEnd,
  onRegenerateScene,
  onDescriptionChange,
  onDurationChange,
  onDeleteScene,
  onRegenerateNarration,
  onRegenerateNarrationWithText,
  onNarrationTextChange,
  onShowVoiceDialog,
  canDelete,
  projectId,
}: SceneCardProps) => {
  return (
    <Card
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      className={`p-6 transition-all cursor-grab active:cursor-grabbing ${
        draggedIndex === index ? "opacity-50" : ""
      }`}
    >
      <div className="flex gap-4">
        {/* Drag Handle */}
        <div className="flex items-center text-muted-foreground cursor-grab active:cursor-grabbing">
          <GripVertical className="w-5 h-5" />
        </div>

        {/* Scene Number & Image */}
        <div className="shrink-0">
          <Badge className="mb-2">Scene {index + 1}</Badge>
          <SceneImage
            scene={scene}
            index={index}
            isRegenerating={isRegenerating}
            onRegenerate={() => onRegenerateScene(scene.id)}
          />
        </div>

        {/* Scene Content */}
        <div className="flex-1 space-y-4">
          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Scene Prompt{" "}
              <span className="text-muted-foreground font-normal">
                (for video generation)
              </span>
            </label>
            <Textarea
              value={scene.description}
              onChange={(e) => onDescriptionChange(scene.id, e.target.value)}
              className="min-h-[120px] resize-y text-sm"
              placeholder="Detailed visual description for AI video generation..."
            />
          </div>

          {/* Narration Controls */}
          <NarrationControls
            scene={scene}
            currentVoiceLabel={currentVoiceLabel}
            isAudioGenerating={isAudioGenerating}
            onRegenerateNarration={onRegenerateNarration}
            onRegenerateNarrationWithText={onRegenerateNarrationWithText}
            onNarrationTextChange={onNarrationTextChange}
            onShowVoiceDialog={onShowVoiceDialog}
            projectId={projectId}
          />

          {/* Duration & Delete */}
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Duration: {scene.duration}s
              </label>
              <Slider
                value={[scene.duration]}
                onValueChange={([value]) => onDurationChange(scene.id, value)}
                min={5}
                max={10}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                WAN 2.5 supports 5s or 10s clips
              </p>
            </div>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => onDeleteScene(scene.id)}
              disabled={!canDelete}
              title="Delete scene"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
