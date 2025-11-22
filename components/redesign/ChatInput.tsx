"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Image, Video, Plus, Sparkles } from "lucide-react";
import {
  ChatSettings,
  GenerationSettings,
  ModelOption,
} from "./ChatSettings";
import {
  TEXT_TO_IMAGE_MODELS,
  IMAGE_TO_VIDEO_MODELS,
  SPEED_INDICATORS,
  COST_INDICATORS,
} from "@/lib/types/models";
import { cn } from "@/lib/utils";

const ALLOWED_IMAGE_MODEL_IDS = [
  "flux-schnell",
  "flux-pro",
  "nano-banana-pro",
  "nano-banana",
] as const;

const DEFAULT_IMAGE_MODEL_OPTIONS: ModelOption[] = ALLOWED_IMAGE_MODEL_IDS.map(
  (modelId) => {
    const model = TEXT_TO_IMAGE_MODELS.find((entry) => entry.id === modelId);
    return {
      id: modelId,
      label: model?.name ?? modelId,
      description: model
        ? `${SPEED_INDICATORS[model.speed]} • ${COST_INDICATORS[model.cost]}`
        : undefined,
    };
  },
);

const ALLOWED_VIDEO_MODEL_IDS = [
  "wan-video/wan-2.5-i2v-fast",
  "google/veo-3.1",
  "google/veo-3.1-fast",
  "kwaivgi/kling-v2.5-turbo-pro",
] as const;

const DEFAULT_VIDEO_MODEL_OPTIONS: ModelOption[] = ALLOWED_VIDEO_MODEL_IDS.map(
  (modelId) => {
    const model = IMAGE_TO_VIDEO_MODELS.find((entry) => entry.id === modelId);
    return {
      id: modelId,
      label: model?.name ?? modelId,
      description: model
        ? `${SPEED_INDICATORS[model.speed]} • ${COST_INDICATORS[model.cost]}`
        : undefined,
    };
  },
);

const IMAGE_MODEL_FALLBACK =
  DEFAULT_IMAGE_MODEL_OPTIONS[0]?.id ?? "nano-banana";
const VIDEO_MODEL_FALLBACK =
  DEFAULT_VIDEO_MODEL_OPTIONS[0]?.id ?? "wan-video/wan-2.5-i2v-fast";

const ensureModelInOptions = (
  candidate: string | undefined,
  options: ModelOption[],
  fallbackId: string,
) => {
  if (candidate && options.some((option) => option.id === candidate)) {
    return candidate;
  }
  return fallbackId;
};

interface ChatInputProps {
  onSubmit?: (message: string, settings: GenerationSettings) => void;
  placeholder?: string;
  disabled?: boolean;
  initialMessage?: string;
  onMessageChange?: (message: string) => void;
  shouldFocus?: boolean;
  selectedShotId?: string;
  initialMode?: "image" | "video";
  allowEmptySubmit?: boolean;
  imageModelOptions?: ModelOption[];
  videoModelOptions?: ModelOption[];
  initialModel?: string;
  onModelChange?: (modelId: string, mode: "image" | "video") => void;
  highlighted?: boolean;
}

export const ChatInput = ({
  onSubmit,
  placeholder = "Describe what you want to create...",
  disabled = false,
  initialMessage,
  onMessageChange,
  shouldFocus = false,
  selectedShotId,
  initialMode = "image",
  allowEmptySubmit = false,
  imageModelOptions,
  videoModelOptions,
  initialModel,
  onModelChange,
  highlighted = false,
}: ChatInputProps) => {
  const [message, setMessage] = useState(initialMessage || "");
  const [mode, setMode] = useState<"image" | "video">(initialMode);
  const [showSettings, setShowSettings] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resolvedImageOptions = useMemo(
    () => imageModelOptions ?? DEFAULT_IMAGE_MODEL_OPTIONS,
    [imageModelOptions],
  );
  const resolvedVideoOptions = useMemo(
    () => videoModelOptions ?? DEFAULT_VIDEO_MODEL_OPTIONS,
    [videoModelOptions],
  );
  const getFallbackForMode = (mode: "image" | "video") =>
    mode === "video"
      ? resolvedVideoOptions[0]?.id ?? VIDEO_MODEL_FALLBACK
      : resolvedImageOptions[0]?.id ?? IMAGE_MODEL_FALLBACK;

  const getVideoDurationOptions = useCallback(
    (modelId: string): string[] => {
      if (modelId.includes("google/veo-3.1")) {
        return ["4s", "6s", "8s"];
      }
      if (modelId.includes("wan-video")) {
        return ["5s"];
      }
      if (modelId.includes("kling")) {
        return ["5s"];
      }
      return ["5s"];
    },
    [],
  );

  useEffect(() => {
    if (shouldFocus && !disabled && selectedShotId) {
      // Use requestAnimationFrame to ensure DOM is ready after paint
      // This is critical when the component transitions from disabled to enabled
      const id = requestAnimationFrame(() => {
        if (textareaRef.current) {
          console.log('[ChatInput] Attempting to focus textarea', {
            shouldFocus,
            disabled,
            selectedShotId,
            element: textareaRef.current
          });
          textareaRef.current.focus();

          // Verify focus was successful
          setTimeout(() => {
            const isFocused = document.activeElement === textareaRef.current;
            console.log('[ChatInput] Focus result:', isFocused);
            if (!isFocused) {
              console.warn('[ChatInput] Focus failed, retrying...');
              textareaRef.current?.focus();
            }
          }, 100);
        } else {
          console.warn('[ChatInput] textareaRef.current is null');
        }
      });
      return () => cancelAnimationFrame(id);
    }
  }, [shouldFocus, disabled, selectedShotId]);
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const currentMessage =
    initialMessage !== undefined ? initialMessage : message;

  // Settings state
  const [settings, setSettings] = useState<GenerationSettings>(() => {
    const initialFallback = getFallbackForMode(initialMode);
    const initialModelId = ensureModelInOptions(
      initialModel,
      initialMode === "video" ? resolvedVideoOptions : resolvedImageOptions,
      initialFallback,
    );

    return {
      mode: initialMode,
      model: initialModelId,
      audioOn: false,
      duration: "5s",
      quality: "HD",
      aspectRatio: "16:9",
      variationCount: 1,
    };
  });
  useEffect(() => {
    if (!initialModel) {
      return;
    }
    const targetOptions =
      mode === "video" ? resolvedVideoOptions : resolvedImageOptions;
    const fallbackId = getFallbackForMode(mode);
    const sanitizedModel = ensureModelInOptions(
      initialModel,
      targetOptions,
      fallbackId,
    );
    setSettings((prev) =>
      prev.model === sanitizedModel ? prev : { ...prev, model: sanitizedModel },
    );
  }, [initialModel, mode, resolvedImageOptions, resolvedVideoOptions]);

  const handleSubmit = () => {
    const trimmedMessage = currentMessage.trim();
    if (!allowEmptySubmit && trimmedMessage.length === 0) {
      return;
    }

    if (onSubmit) {
      console.log("[ChatInput] Submitting message", {
        mode,
        model: settings.model,
        hasMessage: trimmedMessage.length > 0,
        selectedShotId,
      });
      onSubmit(trimmedMessage, { ...settings, mode });
      if (onMessageChange) {
        onMessageChange("");
      } else {
        setMessage("");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleModelSelection = (modelId: string) => {
    setSettings((prev) => ({ ...prev, model: modelId }));
    console.log("[ChatInput] Updated model selection", {
      mode,
      model: modelId,
      selectedShotId,
    });
    onModelChange?.(modelId, mode);
  };

  const activeModelOptions =
    mode === "video" ? resolvedVideoOptions : resolvedImageOptions;
  const activeVideoModelMeta = useMemo(() => {
    if (mode !== "video") {
      return null;
    }
    return IMAGE_TO_VIDEO_MODELS.find(
      (model) => model.id === settings.model,
    );
  }, [mode, settings.model]);
  const audioSupported = mode === "video" && activeVideoModelMeta?.supportsAudio;
  useEffect(() => {
    if (!audioSupported && settings.audioOn) {
      setSettings((prev) => ({ ...prev, audioOn: false }));
    }
  }, [audioSupported, settings.audioOn]);
  const videoDurationOptions = useMemo(() => {
    if (mode !== "video") {
      return ["3s", "5s", "8s", "10s", "15s"];
    }
    return getVideoDurationOptions(settings.model);
  }, [mode, settings.model, getVideoDurationOptions]);

  useEffect(() => {
    if (mode !== "video") {
      return;
    }
    if (!videoDurationOptions.includes(settings.duration)) {
      setSettings((prev) => ({
        ...prev,
        duration: videoDurationOptions[0] ?? prev.duration,
      }));
    }
  }, [mode, settings.duration, videoDurationOptions]);

  const handleAddAsset = () => {
    // TODO: Implement asset addition
  };

  const canSubmit =
    !disabled && (allowEmptySubmit || currentMessage.trim().length > 0);

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 w-full bg-transparent z-50 transition-all",
        highlighted
          ? "ring-2 ring-emerald-400/50 drop-shadow-[0_15px_35px_rgba(34,197,94,0.25)]"
          : "ring-0 opacity-95",
      )}
    >
      <div className="max-w-4xl mx-auto p-3 mb-2">
        <div className="relative bg-[#2C2D2D]/95 backdrop-blur-md rounded-xl shadow-2xl">
          <div className="flex">
            {/* COMMENTED OUT: Left: Mode toggle (vertical stack) - spans full height */}
            {/* <div className="relative flex flex-col gap-0 overflow-hidden bg-[#131414]"> */}
              {/* Sliding indicator background */}
              {/* <motion.div
                className="absolute inset-x-0"
                initial={false}
                animate={{
                  top: mode === "image" ? "0%" : "50%",
                  backgroundColor: mode === "image" ? "#2C2D2D" : "#3A3B3B",
                  borderTopLeftRadius: mode === "image" ? "0.75rem" : "0",
                  borderBottomLeftRadius: mode === "video" ? "0.75rem" : "0",
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
                style={{ height: "50%" }}
              /> */}

              {/* <button
                onClick={() => setMode("image")}
                className={`relative z-10 px-3 py-3 text-[10px] font-medium flex items-center gap-1.5 cursor-pointer flex-1 transition-colors rounded-tl-xl ${
                  mode === "image"
                    ? "text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Image className="w-4 h-4" />
                IMAGE
              </button> */}
              {/* <button
                onClick={() => setMode("video")}
                className={`relative z-10 px-3 py-3 text-[10px] font-medium flex items-center gap-1.5 cursor-pointer flex-1 transition-colors rounded-bl-xl ${
                  mode === "video"
                    ? "text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Video className="w-4 h-4" />
                VIDEO
              </button> */}
            {/* </div> */}

            {/* Right side: Main input area and settings */}
            <div className="flex-1 flex flex-col gap-1.5 p-2.5">
              {/* Top: Input controls */}
              <div className="flex items-start gap-2">
                {/* COMMENTED OUT: Add asset button */}
                {/* <button
                  onClick={handleAddAsset}
                  className="w-12 h-12 rounded-lg bg-[#171717] hover:bg-[#1f1f1f] transition-colors flex items-center justify-center text-gray-400 hover:text-gray-200 cursor-pointer"
                  disabled={disabled}
                >
                  <Plus className="w-5 h-5" />
                </button> */}

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={currentMessage}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    if (onMessageChange) {
                      onMessageChange(newValue);
                    } else {
                      setMessage(newValue);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  disabled={disabled}
                  rows={3}
                  className="flex-1 bg-[#171717] text-gray-100 placeholder:text-gray-500 resize-none py-2 px-3 rounded-lg text-xs transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:border-cyan-400/40"
                />

                {/* Generate button - square */}
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="w-9 h-9 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>

              {/* Bottom: Settings */}
              <ChatSettings
                mode={mode}
                settings={settings}
                onSettingsChange={setSettings}
                modelOptions={activeModelOptions}
                onModelChange={handleModelSelection}
                disableAudioControls={!audioSupported && mode === "video"}
                videoDurationOptions={videoDurationOptions}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
