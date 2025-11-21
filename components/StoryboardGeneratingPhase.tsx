"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Check,
  Sparkles,
  Image as ImageIcon,
  Zap,
  Wand2,
  AudioLines,
} from "lucide-react";

interface Scene {
  sceneNumber: number;
  description: string;
  imageUrl?: string;
  duration: number;
}

type StoryboardStage =
  | "parsing_prompt"
  | "planning_scenes"
  | "selecting_voice"
  | "generating_images"
  | "generating_narrations"
  | "finalizing"
  | "complete";

interface StoryboardGeneratingPhaseProps {
  scenes: Scene[];
  totalScenes: number;
  currentStage: StoryboardStage;
  currentSceneNumber?: number;
  modelName?: string;
  estimatedCostPerImage?: number;
  modelReason?: string;
}

export const StoryboardGeneratingPhase = ({
  scenes,
  totalScenes,
  currentStage,
  currentSceneNumber = 0,
  modelName = "FLUX.1 Schnell",
  estimatedCostPerImage = 0.003,
  modelReason = "Default selection for fast, cost-effective generation",
}: StoryboardGeneratingPhaseProps) => {
  const imagesGenerated = scenes.filter((s) => s.imageUrl).length;

  const getProgress = () => {
    switch (currentStage) {
      case "parsing_prompt":
        return 5;
      case "planning_scenes":
        return 20;
      case "selecting_voice":
        return 35;
      case "generating_images":
        return 35 + (imagesGenerated / totalScenes) * 35;
      case "generating_narrations":
        return 80;
      case "finalizing":
        return 95;
      case "complete":
        return 100;
      default:
        return 0;
    }
  };

  const progress = getProgress();

  const stageDescriptionMap: Record<StoryboardStage, string> = {
    parsing_prompt: "Parsing your prompt and questionnaire responses...",
    planning_scenes: "Planning storyboard scenes with AI...",
    selecting_voice: "Selecting the best narration voice...",
    generating_images: `Generating scene imagery (${imagesGenerated}/${totalScenes})...`,
    generating_narrations: "Synthesizing narration audio...",
    finalizing: "Finalizing storyboard assets...",
    complete: "Storyboard complete!",
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="w-full max-w-4xl px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            <h1 className="text-3xl font-bold">Creating Your Storyboard</h1>
          </div>
          <p className="text-muted-foreground">
            {stageDescriptionMap[currentStage]}
          </p>
        </div>

        {/* Model Selection Info */}
        <Card className="p-5 mb-4 bg-linear-to-r from-primary/10 via-primary/5 to-transparent border-primary/30">
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Wand2 className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-sm font-semibold text-foreground">
                  AI Image Model
                </h3>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  <Badge
                    variant="default"
                    className="text-xs font-medium px-2 py-0.5"
                  >
                    {modelName}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {modelReason}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="font-medium text-foreground">
                    ${(totalScenes * estimatedCostPerImage).toFixed(3)}
                  </span>
                  <span>total cost</span>
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span>${estimatedCostPerImage.toFixed(3)} per image</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Overall Progress */}
        <Card className="p-8 mb-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-2xl font-bold text-primary">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          <div className="text-sm text-muted-foreground">
            {currentStage === "complete"
              ? "All scenes generated successfully!"
              : currentStage === "generating_narrations"
                ? "Generating narration audio for each scene..."
                : currentStage === "finalizing"
                  ? "Finalizing storyboard assets..."
                  : `Estimated time remaining: ${Math.max(
                      5,
                      Math.ceil((totalScenes - imagesGenerated) * 8),
                    )}s`}
          </div>
        </Card>

        {/* Scenes Grid */}
        {scenes.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Scene Generation</h3>
            </div>
            {currentStage === "generating_narrations" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <AudioLines className="w-4 h-4" />
                Generating narration audio...
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: totalScenes }).map((_, index) => {
                const scene = scenes[index];
                const hasImage = scene?.imageUrl;
                const isGenerating =
                  currentStage === "generating_images" &&
                  currentSceneNumber === index + 1 &&
                  !hasImage;

                return (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      hasImage
                        ? "border-primary/30 bg-accent/30"
                        : isGenerating
                          ? "border-primary/50 bg-primary/5"
                          : "border-border bg-transparent"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Status Icon */}
                      <div className="shrink-0 mt-1">
                        {hasImage ? (
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-5 h-5 text-primary-foreground" />
                          </div>
                        ) : isGenerating ? (
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        ) : (
                          <div className="w-8 h-8 rounded-full border-2 border-border flex items-center justify-center">
                            <span className="text-sm text-muted-foreground">
                              {index + 1}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Scene Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-sm">
                            Scene {index + 1}
                          </h4>
                          {hasImage && (
                            <Badge variant="default" className="text-xs">
                              Complete
                            </Badge>
                          )}
                          {isGenerating && (
                            <Badge variant="default" className="text-xs">
                              Generating...
                            </Badge>
                          )}
                        </div>

                        {scene?.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {scene.description}
                          </p>
                        )}

                        {/* Image Preview */}
                        {hasImage && (
                          <div className="mt-2 rounded-md overflow-hidden border border-border">
                            <img
                              src={scene.imageUrl}
                              alt={`Scene ${index + 1}`}
                              className="w-full h-24 object-cover"
                            />
                          </div>
                        )}

                        {!scene && (
                          <div className="text-xs text-muted-foreground">
                            Waiting to generate...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Cost Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Estimated cost:{" "}
            <span className="font-medium text-foreground">
              ${(totalScenes * estimatedCostPerImage).toFixed(2)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
