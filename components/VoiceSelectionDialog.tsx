"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  MINIMAX_VOICES,
  MINIMAX_EMOTIONS,
  type MiniMaxVoiceId,
} from "@/lib/voice-selection";
import { cn } from "@/lib/utils";

export interface VoiceSelectionDialogSelection {
  voiceId: MiniMaxVoiceId;
  emotion?: string;
  speed?: number;
  pitch?: number;
  reasoning?: string;
  regenerateAll?: boolean;
}

interface VoiceSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  defaultVoiceId: MiniMaxVoiceId;
  defaultEmotion?: string;
  defaultSpeed?: number;
  defaultPitch?: number;
  onConfirm: (selection: VoiceSelectionDialogSelection) => Promise<void> | void;
  disabled?: boolean;
}

export const VoiceSelectionDialog = ({
  open,
  onClose,
  defaultVoiceId,
  defaultEmotion,
  defaultSpeed,
  defaultPitch,
  onConfirm,
  disabled,
}: VoiceSelectionDialogProps) => {
  const [voiceId, setVoiceId] = useState<MiniMaxVoiceId>(defaultVoiceId);
  const [emotion, setEmotion] = useState<string>(defaultEmotion || "auto");
  const [speed, setSpeed] = useState<number>(defaultSpeed ?? 1);
  const [pitch, setPitch] = useState<number>(defaultPitch ?? 0);
  const [reasoning, setReasoning] = useState("");
  const [regenerateAll, setRegenerateAll] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState<
    MiniMaxVoiceId | null
  >(null);

  useEffect(() => {
    if (open) {
      setVoiceId(defaultVoiceId);
      setEmotion(defaultEmotion || "auto");
      setSpeed(defaultSpeed ?? 1);
      setPitch(defaultPitch ?? 0);
      setReasoning("");
      setRegenerateAll(true);
      setPreviewUrl(null);
      setPreviewingVoice(null);
    }
  }, [open, defaultVoiceId, defaultEmotion, defaultSpeed, defaultPitch]);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm({
        voiceId,
        emotion,
        speed,
        pitch,
        reasoning,
        regenerateAll,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreview = async (targetVoiceId: MiniMaxVoiceId) => {
    setPreviewingVoice(targetVoiceId);
    try {
      const response = await fetch("/api/preview-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: targetVoiceId,
          emotion,
          speed,
          pitch,
        }),
      });

      if (!response.ok) {
        throw new Error("Preview failed");
      }

      const data = await response.json();
      setPreviewUrl(data.audioUrl);
      setVoiceId(targetVoiceId);
    } catch (error) {
      console.error("Failed to preview voice:", error);
    } finally {
      setPreviewingVoice(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Select narration voice</DialogTitle>
          <DialogDescription>
            Pick a MiniMax Speech-02-HD voice and optionally adjust emotion,
            speed, or pitch before regenerating your scene narrations.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 max-h-[50vh] overflow-y-auto pr-1">
          {Object.values(MINIMAX_VOICES).map((voice) => (
            <div
              key={voice.id}
              className={cn(
                "border rounded-lg p-4 transition-colors cursor-pointer",
                voiceId === voice.id
                  ? "border-primary bg-primary/5"
                  : "border-border",
              )}
              onClick={() => setVoiceId(voice.id)}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{voice.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {voice.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ideal for: {voice.idealUseCases.join(", ")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    handlePreview(voice.id);
                  }}
                  disabled={previewingVoice !== null}
                >
                  {previewingVoice === voice.id ? "Loading..." : "Preview"}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Emotion</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={emotion}
              onChange={(e) => setEmotion(e.target.value)}
            >
              {MINIMAX_EMOTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Speed (0.5 - 2.0)
              </label>
              <Input
                type="number"
                min={0.5}
                max={2}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Pitch (-12 - +12)
              </label>
              <Input
                type="number"
                min={-12}
                max={12}
                step={0.5}
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              Why this voice? (optional)
            </label>
            <Textarea
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              placeholder="Explain why this voice fits your story..."
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={regenerateAll}
              onChange={(e) => setRegenerateAll(e.target.checked)}
            />
            Regenerate narration for all scenes with this voice
          </label>
          {previewUrl && (
            <div>
              <label className="text-sm font-medium mb-1 block">
                Latest preview
              </label>
              <audio controls className="w-full">
                <source src={previewUrl} type="audio/wav" />
              </audio>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onClose()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
            <Button
              variant="secondary"
              onClick={() => handlePreview(voiceId)}
              disabled={isSubmitting || previewingVoice !== null}
            >
              {previewingVoice ? "Generating Preview..." : "Preview Voice"}
            </Button>
          <Button
            onClick={handleConfirm}
            disabled={disabled || isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Apply Voice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
