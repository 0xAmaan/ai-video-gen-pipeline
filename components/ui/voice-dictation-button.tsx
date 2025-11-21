"use client";

import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceDictationButtonProps {
  isListening: boolean;
  isSupported: boolean;
  onToggle: () => void;
  disabled?: boolean;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export const VoiceDictationButton = ({
  isListening,
  isSupported,
  onToggle,
  disabled = false,
  variant = "outline",
  size = "default",
  className,
}: VoiceDictationButtonProps) => {
  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        className={cn("opacity-50 cursor-not-allowed", className)}
      >
        <MicOff className="w-5 h-5 text-gray-400" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "transition-all duration-200 cursor-pointer hover:opacity-80",
        isListening &&
          "animate-pulse",
        className
      )}
      aria-label={
        isListening ? "Stop voice dictation" : "Start voice dictation"
      }
    >
      <Mic 
        className={cn(
          "w-5 h-5 transition-all",
          isListening 
            ? "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" 
            : "text-gray-400"
        )} 
      />
    </button>
  );
};
