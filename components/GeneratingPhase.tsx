"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check } from "lucide-react";

interface GeneratingPhaseProps {
  onComplete: () => void;
}

interface Stage {
  id: string;
  label: string;
  description: string;
}

const STAGES: Stage[] = [
  {
    id: "parsing",
    label: "Parsing Prompt",
    description: "Analyzing your creative direction and requirements",
  },
  {
    id: "planning",
    label: "Planning Scenes",
    description: "Breaking down video structure and timing",
  },
  {
    id: "audio",
    label: "Processing Audio",
    description: "Generating audio structure and beat detection",
  },
  {
    id: "clips",
    label: "Generating Clips",
    description: "Creating AI-generated video segments",
  },
  {
    id: "composing",
    label: "Composing Video",
    description: "Stitching clips with transitions and effects",
  },
  {
    id: "rendering",
    label: "Final Render",
    description: "Rendering your video in high quality",
  },
];

export const GeneratingPhase = ({ onComplete }: GeneratingPhaseProps) => {
  const [progress, setProgress] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  // Calculate which stages are complete based on progress
  const getStageStatus = (index: number) => {
    const stageProgress = ((index + 1) / STAGES.length) * 100;
    if (progress >= stageProgress) return "complete";
    if (index === currentStageIndex) return "processing";
    return "pending";
  };

  // Simulate progress
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => onComplete(), 500);
          return 100;
        }
        return prev + 1;
      });
    }, 100); // Increment every 100ms (10 seconds total)

    return () => clearInterval(interval);
  }, [onComplete]);

  // Update current stage based on progress
  useEffect(() => {
    const newStageIndex = Math.min(
      Math.floor((progress / 100) * STAGES.length),
      STAGES.length - 1,
    );
    setCurrentStageIndex(newStageIndex);
  }, [progress]);

  const timeRemaining = Math.ceil(((100 - progress) / 100) * 10); // seconds

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="w-full max-w-3xl px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <h1 className="text-3xl font-bold">Generating Your Video</h1>
          </div>
          <p className="text-muted-foreground">
            This usually takes 5-10 seconds
          </p>
        </div>

        {/* Overall Progress */}
        <Card className="p-8 mb-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-2xl font-bold text-primary">
                {progress}%
              </span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {progress < 100
                ? `Estimated time remaining: ${timeRemaining}s`
                : "Complete!"}
            </span>
            <Badge variant="secondary">Using optimized models</Badge>
          </div>
        </Card>

        {/* Stages */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4">Generation Pipeline</h3>
          <div className="space-y-4">
            {STAGES.map((stage, index) => {
              const status = getStageStatus(index);
              return (
                <div
                  key={stage.id}
                  className={`flex items-start gap-4 p-4 rounded-lg transition-all ${
                    status === "processing"
                      ? "bg-primary/5 border-2 border-primary/20"
                      : status === "complete"
                        ? "bg-accent/30"
                        : "bg-transparent"
                  }`}
                >
                  {/* Status Icon */}
                  <div className="shrink-0 mt-0.5">
                    {status === "complete" ? (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    ) : status === "processing" ? (
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-border flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">
                          {index + 1}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Stage Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4
                        className={`font-medium ${
                          status === "complete"
                            ? "line-through text-muted-foreground"
                            : status === "processing"
                              ? "text-foreground"
                              : "text-muted-foreground"
                        }`}
                      >
                        {stage.label}
                      </h4>
                      {status === "processing" && (
                        <Badge variant="default" className="bg-primary text-xs">
                          In Progress
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {stage.description}
                    </p>
                  </div>

                  {/* Stage Number */}
                  <div className="text-xs text-muted-foreground">
                    {index + 1}/{STAGES.length}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Cost Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Estimated cost:{" "}
            <span className="font-medium text-foreground">$1.20</span>
          </p>
        </div>
      </div>
    </div>
  );
};
