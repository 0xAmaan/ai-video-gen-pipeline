"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Activity, Loader2 } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BeatAnalysisButtonProps {
  assetId: Id<"audioAssets">;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  disabled?: boolean;
}

export function BeatAnalysisButton({
  assetId,
  size = "default",
  variant = "outline",
  disabled = false,
}: BeatAnalysisButtonProps) {
  const analyzeBeatsMutation = useMutation(api.beatAnalysis.analyzeBeatsMutation);
  const beatAnalysisStatus = useQuery(api.beatAnalysis.getAnalysisStatus, {
    assetId,
  });

  const isAnalyzing = beatAnalysisStatus?.status === "analyzing";
  const hasAnalysis = beatAnalysisStatus?.hasMarkers ?? false;
  const analysisError = beatAnalysisStatus?.error;

  const handleAnalyzeBeats = async () => {
    try {
      await analyzeBeatsMutation({ assetId });
      toast.success("Beat analysis started! This may take a moment...");
    } catch (error) {
      console.error("Beat analysis failed:", error);
      toast.error(
        error instanceof Error
          ? `Failed to analyze beats: ${error.message}`
          : "Failed to analyze beats. Please try again."
      );
    }
  };

  const getButtonContent = () => {
    if (isAnalyzing) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {size !== "icon" && <span className="ml-2">Analyzing...</span>}
        </>
      );
    }

    if (hasAnalysis) {
      return (
        <>
          <Activity className="h-4 w-4 text-green-600" />
          {size !== "icon" && <span className="ml-2">Re-analyze</span>}
        </>
      );
    }

    return (
      <>
        <Activity className="h-4 w-4" />
        {size !== "icon" && <span className="ml-2">Analyze Beats</span>}
      </>
    );
  };

  const getTooltipText = () => {
    if (isAnalyzing) return "Beat analysis in progress...";
    if (analysisError) return `Error: ${analysisError}`;
    if (hasAnalysis) {
      const bpm = beatAnalysisStatus?.bpm;
      const beatCount = beatAnalysisStatus?.beatCount ?? 0;
      return `${beatCount} beats detected${bpm ? ` • ${Math.round(bpm)} BPM` : ""}`;
    }
    return "Analyze beats for snapping to music";
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={variant}
            onClick={handleAnalyzeBeats}
            disabled={disabled || isAnalyzing}
            className="shrink-0"
          >
            {getButtonContent()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
