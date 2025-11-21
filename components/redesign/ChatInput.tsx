"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Image, Video, Plus, Sparkles } from "lucide-react";
import { ChatSettings, GenerationSettings } from "./ChatSettings";

interface ChatInputProps {
  onSubmit?: (message: string, settings: GenerationSettings) => void;
  placeholder?: string;
  disabled?: boolean;
  initialMessage?: string;
  onMessageChange?: (message: string) => void;
  shouldFocus?: boolean;
  selectedShotId?: string;
}

export const ChatInput = ({
  onSubmit,
  placeholder = "Describe what you want to create...",
  disabled = false,
  initialMessage,
  onMessageChange,
  shouldFocus = false,
  selectedShotId,
}: ChatInputProps) => {
  const [message, setMessage] = useState(initialMessage || "");
  const [mode, setMode] = useState<"image" | "video">("image");
  const [showSettings, setShowSettings] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const currentMessage =
    initialMessage !== undefined ? initialMessage : message;

  // Settings state
  const [settings, setSettings] = useState<GenerationSettings>({
    mode: "image",
    model: "flux-pro",
    audioOn: false,
    duration: "5s",
    quality: "HD",
    aspectRatio: "16:9",
    variationCount: 3,
  });

  const handleSubmit = () => {
    if (currentMessage.trim() && onSubmit) {
      onSubmit(currentMessage, { ...settings, mode });
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

  const handleAddAsset = () => {
    // TODO: Implement asset addition
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 w-full bg-transparent z-50">
      <div className="max-w-4xl mx-auto p-3 mb-2">
        <div className="relative bg-[#2C2D2D]/95 backdrop-blur-md rounded-xl shadow-2xl">
          <div className="flex">
            {/* Left: Mode toggle (vertical stack) - spans full height */}
            <div className="relative flex flex-col gap-0 overflow-hidden bg-[#131414]">
              {/* Sliding indicator background */}
              <motion.div
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
              />

              <button
                onClick={() => setMode("image")}
                className={`relative z-10 px-3 py-3 text-[10px] font-medium flex items-center gap-1.5 cursor-pointer flex-1 transition-colors rounded-tl-xl ${
                  mode === "image"
                    ? "text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Image className="w-4 h-4" />
                IMAGE
              </button>
              <button
                onClick={() => setMode("video")}
                className={`relative z-10 px-3 py-3 text-[10px] font-medium flex items-center gap-1.5 cursor-pointer flex-1 transition-colors rounded-bl-xl ${
                  mode === "video"
                    ? "text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Video className="w-4 h-4" />
                VIDEO
              </button>
            </div>

            {/* Right side: Main input area and settings */}
            <div className="flex-1 flex flex-col gap-1.5 p-2.5">
              {/* Top: Input controls */}
              <div className="flex items-start gap-2">
                {/* Add asset button */}
                <button
                  onClick={handleAddAsset}
                  className="w-12 h-12 rounded-lg bg-[#171717] hover:bg-[#1f1f1f] transition-colors flex items-center justify-center text-gray-400 hover:text-gray-200 cursor-pointer"
                  disabled={disabled}
                >
                  <Plus className="w-5 h-5" />
                </button>

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
                  disabled={disabled || !currentMessage.trim()}
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
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
