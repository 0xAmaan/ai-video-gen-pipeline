"use client";

import { useEffect, useMemo, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MINIMAX_VOICES,
  MINIMAX_EMOTIONS,
  type MiniMaxVoiceId,
} from "@/lib/voice-selection";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "@/components/audio/AudioPlayer";

type VoiceProvider = "replicate" | "elevenlabs";

const PROVIDER_OPTIONS: Array<{
  id: VoiceProvider;
  label: string;
  defaultModel: string;
}> = [
  {
    id: "replicate",
    label: "Replicate (MiniMax)",
    defaultModel: "replicate-minimax-tts",
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    defaultModel: "elevenlabs-multilingual-v2",
  },
];

const ELEVENLABS_MODELS = [
  {
    value: "elevenlabs-multilingual-v2",
    label: "Multilingual v2",
    description: "Best for global narration with style control",
  },
  {
    value: "elevenlabs-conversational-v1",
    label: "Conversational v1",
    description: "Great for expressive, dialogue-style reads",
  },
];

type ElevenLabsVoice = {
  id: string;
  name: string;
  previewUrl?: string;
  labels?: Record<string, string>;
};

export interface VoiceSelectionDialogSelection {
  voiceId: string;
  voiceName?: string;
  voiceProvider?: VoiceProvider;
  voiceModelKey?: string;
  emotion?: string;
  speed?: number;
  pitch?: number;
  reasoning?: string;
  regenerateAll?: boolean;
}

interface VoiceSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  defaultVoiceId: string;
  defaultVoiceName?: string;
  defaultVoiceProvider?: VoiceProvider;
  defaultVoiceModelKey?: string;
  defaultEmotion?: string;
  defaultSpeed?: number;
  defaultPitch?: number;
  onConfirm: (selection: VoiceSelectionDialogSelection) => Promise<void> | void;
  disabled?: boolean;
}

const PREVIEW_SAMPLE =
  "Hello there! Here's a quick preview of this narration voice.";

export const VoiceSelectionDialog = ({
  open,
  onClose,
  defaultVoiceId,
  defaultVoiceName,
  defaultVoiceProvider = "replicate",
  defaultVoiceModelKey,
  defaultEmotion,
  defaultSpeed,
  defaultPitch,
  onConfirm,
  disabled,
}: VoiceSelectionDialogProps) => {
  const initialReplicateVoice = useMemo(() => {
    const candidate =
      (defaultVoiceId as MiniMaxVoiceId) in MINIMAX_VOICES
        ? (defaultVoiceId as MiniMaxVoiceId)
        : ("Wise_Woman" as MiniMaxVoiceId);
    return candidate;
  }, [defaultVoiceId]);

  const [voiceProvider, setVoiceProvider] =
    useState<VoiceProvider>(defaultVoiceProvider);
  const [voiceModelKey, setVoiceModelKey] = useState<string>(
    defaultVoiceModelKey ??
      PROVIDER_OPTIONS.find((option) => option.id === defaultVoiceProvider)
        ?.defaultModel ??
      "replicate-minimax-tts",
  );
  const [voiceId, setVoiceId] = useState<string>(
    defaultVoiceId || initialReplicateVoice,
  );
  const [voiceName, setVoiceName] = useState<string>(
    defaultVoiceName ||
      MINIMAX_VOICES[initialReplicateVoice]?.name ||
      "Wise Woman",
  );
  const [emotion, setEmotion] = useState<string>(defaultEmotion || "auto");
  const [speed, setSpeed] = useState<number>(defaultSpeed ?? 1);
  const [pitch, setPitch] = useState<number>(defaultPitch ?? 0);
  const [reasoning, setReasoning] = useState("");
  const [regenerateAll, setRegenerateAll] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>(
    [],
  );
  const [elevenLabsError, setElevenLabsError] = useState<string | null>(null);
  const [loadingElevenLabsVoices, setLoadingElevenLabsVoices] =
    useState(false);

  useEffect(() => {
    if (open) {
      setVoiceProvider(defaultVoiceProvider);
      setVoiceModelKey(
        defaultVoiceModelKey ??
          PROVIDER_OPTIONS.find(
            (option) => option.id === defaultVoiceProvider,
          )?.defaultModel ??
          "replicate-minimax-tts",
      );
      setVoiceId(defaultVoiceId || initialReplicateVoice);
      setVoiceName(
        defaultVoiceName ||
          MINIMAX_VOICES[defaultVoiceId as MiniMaxVoiceId]?.name ||
          "Wise Woman",
      );
      setEmotion(defaultEmotion || "auto");
      setSpeed(defaultSpeed ?? 1);
      setPitch(defaultPitch ?? 0);
      setReasoning("");
      setRegenerateAll(true);
      setPreviewUrl(null);
      setElevenLabsError(null);
    }
  }, [
    open,
    defaultVoiceId,
    defaultVoiceName,
    defaultVoiceProvider,
    defaultVoiceModelKey,
    defaultEmotion,
    defaultSpeed,
    defaultPitch,
    initialReplicateVoice,
  ]);

  useEffect(() => {
    if (!open || voiceProvider !== "elevenlabs" || elevenLabsVoices.length > 0) {
      return;
    }
    setLoadingElevenLabsVoices(true);
    setElevenLabsError(null);
    fetch("/api/list-elevenlabs-voices")
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData?.error || "Unable to load ElevenLabs voices",
          );
        }
        return response.json();
      })
      .then((data) => {
        const voices: ElevenLabsVoice[] = (data.voices ?? []).map(
          (voice: any) => ({
            id: voice.id,
            name: voice.name,
            previewUrl: voice.previewUrl,
            labels: voice.labels,
          }),
        );
        setElevenLabsVoices(voices);
        if (voices.length > 0 && (!voiceId || defaultVoiceProvider !== "elevenlabs")) {
          setVoiceId(voices[0].id);
          setVoiceName(voices[0].name);
        }
      })
      .catch((error) => {
        setElevenLabsError(
          error instanceof Error ? error.message : "Failed to load voices",
        );
      })
      .finally(() => setLoadingElevenLabsVoices(false));
  }, [open, voiceProvider, elevenLabsVoices.length, voiceId, defaultVoiceProvider]);

  const handleProviderChange = (provider: VoiceProvider) => {
    setVoiceProvider(provider);
    const providerDefaults =
      PROVIDER_OPTIONS.find((option) => option.id === provider) ??
      PROVIDER_OPTIONS[0];
    setVoiceModelKey(providerDefaults.defaultModel);
    if (provider === "replicate") {
      const fallback = initialReplicateVoice;
      setVoiceId(fallback);
      setVoiceName(MINIMAX_VOICES[fallback]?.name ?? "Wise Woman");
    } else if (provider === "elevenlabs") {
      const firstVoice = elevenLabsVoices[0];
      if (firstVoice) {
        setVoiceId(firstVoice.id);
        setVoiceName(firstVoice.name);
      } else {
        setVoiceId("");
        setVoiceName("");
      }
    }
  };

  const handleConfirm = async () => {
    if (!voiceId) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm({
        voiceId,
        voiceName,
        voiceProvider,
        voiceModelKey,
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

  const handlePreview = async () => {
    if (!voiceId) return;
    setPreviewing(true);
    try {
      let previewAudioUrl: string | null = null;
      if (voiceProvider === "elevenlabs") {
        const response = await fetch("/api/generate-voice-elevenlabs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: PREVIEW_SAMPLE,
            voiceId,
            emotion,
            speed,
            pitch,
            modelKey: voiceModelKey,
          }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData?.error || "Unable to generate ElevenLabs preview",
          );
        }
        const data = await response.json();
        previewAudioUrl = data.audioUrl;
      } else {
        const response = await fetch("/api/preview-voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: PREVIEW_SAMPLE,
            voiceId,
            emotion,
            speed,
            pitch,
          }),
        });
        if (!response.ok) {
          throw new Error("Preview failed");
        }
        const data = await response.json();
        previewAudioUrl = data.audioUrl;
      }
      if (previewAudioUrl) {
        setPreviewUrl(previewAudioUrl);
      }
    } catch (error) {
      console.error("Failed to preview voice:", error);
    } finally {
      setPreviewing(false);
    }
  };

  const renderVoiceCards = () => {
    if (voiceProvider === "elevenlabs") {
      if (loadingElevenLabsVoices) {
        return (
          <p className="text-sm text-muted-foreground">
            Loading ElevenLabs voices...
          </p>
        );
      }
      if (elevenLabsError) {
        return (
          <p className="text-sm text-destructive">{elevenLabsError}</p>
        );
      }
      if (!elevenLabsVoices.length) {
        return (
          <p className="text-sm text-muted-foreground">
            No ElevenLabs voices available. Configure voices in your ElevenLabs dashboard.
          </p>
        );
      }
      return elevenLabsVoices.map((voice) => (
        <div
          key={voice.id}
          className={cn(
            "border rounded-lg p-4 transition-colors cursor-pointer",
            voiceId === voice.id
              ? "border-primary bg-primary/5"
              : "border-border",
          )}
          onClick={() => {
            setVoiceId(voice.id);
            setVoiceName(voice.name);
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{voice.name}</p>
              {voice.labels && (
                <p className="text-xs text-muted-foreground mt-1">
                  {Object.values(voice.labels).join(", ")}
                </p>
              )}
            </div>
            {voice.previewUrl && (
              <AudioPlayer
                className="w-40 sm:w-48"
                src={voice.previewUrl}
                label="VoiceSelectionPreview"
                debugContext={{ provider: "elevenlabs", voiceId: voice.id }}
              />
            )}
          </div>
        </div>
      ));
    }

    return Object.values(MINIMAX_VOICES).map((voice) => (
      <div
        key={voice.id}
        className={cn(
          "border rounded-lg p-4 transition-colors cursor-pointer",
          voiceId === voice.id
            ? "border-primary bg-primary/5"
            : "border-border",
        )}
        onClick={() => {
          setVoiceId(voice.id);
          setVoiceName(voice.name);
        }}
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
        </div>
      </div>
    ));
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Select narration voice</DialogTitle>
          <DialogDescription>
            Choose a provider, voice, and delivery style. We&apos;ll remember
            your selection for future scenes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-2">
            {PROVIDER_OPTIONS.map((option) => (
              <Button
                key={option.id}
                variant={voiceProvider === option.id ? "secondary" : "outline"}
                size="sm"
                onClick={() => handleProviderChange(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {voiceProvider === "elevenlabs" && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                ElevenLabs model
              </label>
              <Select
                value={voiceModelKey}
                onValueChange={(value) => setVoiceModelKey(value)}
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ELEVENLABS_MODELS.map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      <div className="flex flex-col">
                        <span>{model.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {model.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Voice ID (override)
                </label>
                <Input
                  value={voiceId}
                  onChange={(e) => {
                    setVoiceId(e.target.value);
                    if (voiceProvider === "elevenlabs") {
                      setVoiceName("Custom ElevenLabs Voice");
                    }
                  }}
                  placeholder="elevenlabs-voice-id"
                />
              </div>
            </div>
          )}

          <div className="grid gap-4">{renderVoiceCards()}</div>

          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Emotion / Style
              </label>
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
                <AudioPlayer
                  className="w-full"
                  src={previewUrl}
                  label="VoicePreview"
                  debugContext={{
                    provider: voiceProvider,
                    voiceId,
                    emotion,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onClose()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handlePreview}
            disabled={previewing || isSubmitting || !voiceId}
          >
            {previewing ? "Generating Preview..." : "Preview Voice"}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={disabled || isSubmitting || !voiceId}
          >
            {isSubmitting ? "Saving..." : "Apply Voice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
