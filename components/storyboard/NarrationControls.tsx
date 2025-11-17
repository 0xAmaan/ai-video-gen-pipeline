import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { Scene } from "@/types/scene";

interface NarrationControlsProps {
  scene: Scene;
  currentVoiceLabel: string;
  isAudioGenerating: boolean;
  onRegenerateNarration: (id: string) => void;
  onRegenerateNarrationWithText: (id: string) => void;
  onNarrationTextChange: (id: string, text: string) => void;
  onShowVoiceDialog: () => void;
  projectId: string | null;
}

export const NarrationControls = ({
  scene,
  currentVoiceLabel,
  isAudioGenerating,
  onRegenerateNarration,
  onRegenerateNarrationWithText,
  onNarrationTextChange,
  onShowVoiceDialog,
  projectId,
}: NarrationControlsProps) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <Badge
          variant="outline"
          className="cursor-pointer"
          onClick={onShowVoiceDialog}
        >
          Voice: {scene.voiceName || currentVoiceLabel}
        </Badge>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onRegenerateNarration(scene.id)}
            disabled={
              isAudioGenerating || scene.id.startsWith("temp-") || !projectId
            }
          >
            {isAudioGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Regenerate Audio
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRegenerateNarrationWithText(scene.id)}
            disabled={
              isAudioGenerating ||
              !scene.narrationText ||
              scene.id.startsWith("temp-") ||
              !projectId
            }
          >
            {isAudioGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Regenerate with new text
          </Button>
        </div>
      </div>
      {scene.narrationUrl ? (
        <div>
          <audio controls className="w-full">
            <source src={scene.narrationUrl} type="audio/wav" />
          </audio>
          {scene.narrationText && (
            <p className="text-xs text-muted-foreground mt-2 italic">
              "{scene.narrationText}"
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Narration not generated yet.
        </p>
      )}
      <div>
        <label className="text-sm font-medium mb-2 block">Narration Text</label>
        <Textarea
          value={scene.narrationText || ""}
          onChange={(e) => onNarrationTextChange(scene.id, e.target.value)}
          className="min-h-[80px] resize-y text-sm"
          placeholder="What should the narrator say for this scene?"
        />
      </div>
    </div>
  );
};
