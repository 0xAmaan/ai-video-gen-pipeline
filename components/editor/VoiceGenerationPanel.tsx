"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Mic, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { MINIMAX_VOICES, MINIMAX_EMOTIONS, type MiniMaxVoiceId } from "@/lib/voice-selection";
import { AudioPlayer } from "@/components/audio/AudioPlayer";
import type { MediaAssetMeta } from "@/lib/editor/types";
import {
  PROVIDER_OPTIONS,
  REPLICATE_MODELS,
  ELEVENLABS_MODELS,
  MAX_TEXT_LENGTH,
  REQUEST_TIMEOUT,
  type VoiceProvider,
} from "@/lib/voice-models-config";

/**
 * Props for the VoiceGenerationPanel component
 */
interface VoiceGenerationPanelProps {
  /** Callback invoked when a voice asset is successfully generated */
  onAssetCreated: (asset: MediaAssetMeta) => void;
  /** Whether to automatically add generated audio to the timeline (default: false) */
  autoAddToTimeline?: boolean;
}

// Model configurations imported from lib/voice-models-config.ts

/**
 * Voice Generation Panel Component
 *
 * Provides a UI for generating AI voices using Replicate (MiniMax/Bark) or ElevenLabs.
 * Supports multiple voices, emotions, speed/pitch controls, and real-time preview.
 * Generated audio is automatically added to the editor timeline.
 *
 * Features:
 * - Text input with character count and validation (max 5000 chars)
 * - Multiple voice providers (Replicate, ElevenLabs)
 * - 8 pre-configured MiniMax voices for different use cases
 * - Emotion/style controls (10 emotions)
 * - Speed (0.5-2.0x) and pitch (-12 to +12) adjustments
 * - Real-time preview player
 * - Keyboard shortcut: Cmd/Ctrl+Enter to generate
 * - Request timeout (30s) and cancellation support
 *
 * @example
 * ```tsx
 * <VoiceGenerationPanel
 *   onAssetCreated={(asset) => {
 *     actions.addMediaAsset(asset);
 *     actions.appendClipFromAsset(asset.id);
 *   }}
 *   autoAddToTimeline={true}
 * />
 * ```
 */
export const VoiceGenerationPanel = ({
  onAssetCreated,
  autoAddToTimeline = false,
}: VoiceGenerationPanelProps) => {
  const [text, setText] = useState("");
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>("replicate");
  const [voiceModelKey, setVoiceModelKey] = useState("replicate-minimax-turbo");
  const [voiceId, setVoiceId] = useState<string>("Wise_Woman");
  const [emotion, setEmotion] = useState("auto");
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Memoize expensive calculations
  const wordCount = useMemo(() =>
    text.trim().split(/\s+/).filter((w) => w).length,
    [text]
  );

  const estimatedDuration = useMemo(() =>
    Math.max(1, Math.round(wordCount / 2.6)),
    [wordCount]
  );

  const isTextTooLong = useMemo(() =>
    text.length > MAX_TEXT_LENGTH,
    [text.length]
  );

  /**
   * Handles provider change and resets model/voice to appropriate defaults
   */
  const handleProviderChange = (provider: VoiceProvider) => {
    setVoiceProvider(provider);
    const providerDefaults = PROVIDER_OPTIONS.find((opt) => opt.id === provider);
    if (providerDefaults) {
      setVoiceModelKey(providerDefaults.defaultModel);
    }
    if (provider === "replicate") {
      setVoiceId("Wise_Woman");
    }
  };

  /**
   * Generates voice audio from text input
   *
   * Validates text length, cancels any in-flight requests, and calls the
   * voice generation API with a 30-second timeout. On success, creates a
   * MediaAssetMeta and invokes onAssetCreated callback.
   *
   * @throws {Error} If API request fails or times out
   */
  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error("Please enter text to generate voice");
      return;
    }

    // Validate text length
    if (text.length > MAX_TEXT_LENGTH) {
      toast.error(`Text too long. Maximum ${MAX_TEXT_LENGTH} characters (currently ${text.length}).`);
      return;
    }

    // Cancel previous request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      abortControllerRef.current?.abort();
    }, REQUEST_TIMEOUT);

    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-voice-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          voiceId,
          emotion,
          speed,
          pitch,
          modelKey: voiceModelKey,
          vendor: voiceProvider,
        }),
        signal: abortControllerRef.current.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.details || errorData?.error || "Failed to generate voice"
        );
      }

      const data = await response.json();

      if (!data.success || !data.audioUrl) {
        throw new Error("Invalid response from voice generation API");
      }

      // Create a media asset from the generated voice
      const assetId = crypto.randomUUID?.() ?? `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const asset: MediaAssetMeta = {
        id: assetId,
        name: `Voice ${new Date().toLocaleTimeString()}.${data.format}`,
        type: "audio",
        url: data.audioUrl,
        duration: data.durationSeconds || 5,
        waveform: undefined,
        sampleRate: 44100,
        width: 0,
        height: 0,
        fps: 0,
      };

      // Notify parent component
      onAssetCreated(asset);

      // Set preview URL
      setPreviewUrl(data.audioUrl);

      toast.success("Voice generated successfully!");

      // Clear text if auto-add is enabled (for quick iteration)
      if (autoAddToTimeline) {
        setText("");
      }
    } catch (error) {
      console.error("Failed to generate voice:", error);
      
      // Handle abort/timeout separately
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error("Voice generation timed out. Please try with shorter text.");
      } else {
        toast.error(
          error instanceof Error ? error.message : "Failed to generate voice"
        );
      }
    } finally {
      clearTimeout(timeoutId);
      setIsGenerating(false);
    }
  };

  // Keyboard shortcut: Cmd/Ctrl+Enter to generate
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && text.trim() && !isGenerating) {
        e.preventDefault();
        void handleGenerate();
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [text, isGenerating]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="flex h-full flex-col bg-muted/20">
      <div className="border-b border-border px-3 py-2 flex-none">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Voice Generation</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0 hover:[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
        <div className="px-4 py-3 space-y-4">
          {/* Text Input */}
          <div className="space-y-2">
            <Label htmlFor="voice-text" className="text-sm font-medium">
              Text to speak
            </Label>
            <Textarea
              id="voice-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter the text you want to convert to speech..."
              className="min-h-[100px] text-sm resize-none"
              disabled={isGenerating}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {wordCount} words • ~{estimatedDuration}s
              </span>
              <span className={isTextTooLong ? "text-destructive font-medium" : ""}>
                {text.length}/{MAX_TEXT_LENGTH}
              </span>
            </div>
            {isTextTooLong && (
              <p className="text-xs text-destructive mt-1">
                ⚠️ Text exceeds maximum length. Please shorten your text.
              </p>
            )}
          </div>

          {/* Provider Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Provider</Label>
            <div className="flex gap-2">
              {PROVIDER_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  variant={voiceProvider === option.id ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => handleProviderChange(option.id)}
                  disabled={isGenerating}
                  className="flex-1"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="voice-model" className="text-sm font-medium">
              Model
            </Label>
            <Select
              value={voiceModelKey}
              onValueChange={setVoiceModelKey}
              disabled={isGenerating}
            >
              <SelectTrigger id="voice-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-[320px]">
                {(voiceProvider === "replicate"
                  ? REPLICATE_MODELS
                  : ELEVENLABS_MODELS
                ).map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{model.label}</span>
                      <span className="text-xs text-muted-foreground leading-tight">
                        {model.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Voice Selection (for Replicate/MiniMax) */}
          {voiceProvider === "replicate" && voiceModelKey !== "bark-voice" && (
            <div className="space-y-2">
              <Label htmlFor="voice-id" className="text-sm font-medium">
                Voice
              </Label>
              <Select
                value={voiceId}
                onValueChange={setVoiceId}
                disabled={isGenerating}
              >
                <SelectTrigger id="voice-id">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-[320px]">
                  {Object.values(MINIMAX_VOICES).map((voice) => (
                    <SelectItem key={voice.id} value={voice.id}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{voice.name}</span>
                        <span className="text-xs text-muted-foreground leading-tight">
                          {voice.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ElevenLabs Voice ID */}
          {voiceProvider === "elevenlabs" && (
            <div className="space-y-2">
              <Label htmlFor="elevenlabs-voice-id" className="text-sm font-medium">
                Voice ID
              </Label>
              <Input
                id="elevenlabs-voice-id"
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                placeholder="Enter ElevenLabs voice ID"
                disabled={isGenerating}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Find voice IDs in your ElevenLabs dashboard
              </p>
            </div>
          )}

          {/* Emotion/Style */}
          <div className="space-y-2">
            <Label htmlFor="emotion" className="text-sm font-medium">
              Emotion / Style
            </Label>
            <Select value={emotion} onValueChange={setEmotion} disabled={isGenerating}>
              <SelectTrigger id="emotion">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINIMAX_EMOTIONS.map((emo) => (
                  <SelectItem key={emo} value={emo}>
                    {emo.charAt(0).toUpperCase() + emo.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Speed & Pitch */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="speed" className="text-sm font-medium">
                Speed
              </Label>
              <Input
                id="speed"
                type="number"
                min={0.5}
                max={2}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                disabled={isGenerating}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">0.5 - 2.0</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pitch" className="text-sm font-medium">
                Pitch
              </Label>
              <Input
                id="pitch"
                type="number"
                min={-12}
                max={12}
                step={0.5}
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
                disabled={isGenerating}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">-12 to +12</p>
            </div>
          </div>

          {/* Preview Player */}
          {previewUrl && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Latest Generation</Label>
              <AudioPlayer
                src={previewUrl}
                label="VoiceGeneration"
                debugContext={{ provider: voiceProvider, voiceId }}
                className="w-full"
              />
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !text.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Voice...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Voice
              </>
            )}
          </Button>

          {autoAddToTimeline && (
            <p className="text-xs text-center text-muted-foreground">
              Generated audio will be automatically added to the timeline
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
