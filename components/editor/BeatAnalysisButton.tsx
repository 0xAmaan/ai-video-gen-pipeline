"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Music } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

interface BeatAnalysisButtonProps {
  assetId: Id<"audioAssets">;
  disabled?: boolean;
}

export function BeatAnalysisButton({ assetId, disabled = false }: BeatAnalysisButtonProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const analyzeBeatsMutation = useMutation(api.beatAnalysis.analyzeBeatsMutation);

  const handleAnalyze = async () => {
    setAnalyzing(true);
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
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <button
      onClick={handleAnalyze}
      disabled={disabled || analyzing}
      className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Music className={`w-4 h-4 ${analyzing ? "animate-pulse" : ""}`} />
      <span>{analyzing ? "Analyzing..." : "Analyze Beats"}</span>
    </button>
  );
}
