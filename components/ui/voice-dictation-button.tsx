"use client";

import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size={size}
              disabled
              className={cn("opacity-50 cursor-not-allowed", className)}
            >
              <MicOff className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Voice dictation not supported in this browser</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size={size}
            onClick={onToggle}
            disabled={disabled}
            className={cn(
              "transition-all duration-200",
              isListening &&
                "bg-red-500 hover:bg-red-600 text-white border-red-500 animate-pulse",
              className
            )}
            aria-label={
              isListening ? "Stop voice dictation" : "Start voice dictation"
            }
          >
            {isListening ? (
              <>
                <Mic className="w-4 h-4" />
                <span className="ml-2 text-sm hidden sm:inline">
                  Recording...
                </span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span className="ml-2 text-sm hidden sm:inline">
                  Voice Input
                </span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isListening
              ? "Click to stop recording"
              : "Click to start voice dictation"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
