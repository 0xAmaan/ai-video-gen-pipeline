"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Sparkles, Image as ImageIcon } from "lucide-react";

interface Scene {
  sceneNumber: number;
  description: string;
  imageUrl?: string;
  duration: number;
}

interface StoryboardGeneratingPhaseProps {
  scenes: Scene[];
  totalScenes: number;
  currentStage: "generating_descriptions" | "generating_images" | "complete";
  currentSceneNumber?: number;
}

export const StoryboardGeneratingPhase = ({
  scenes,
  totalScenes,
  currentStage,
  currentSceneNumber = 0,
}: StoryboardGeneratingPhaseProps) => {
  const getProgress = () => {
    if (currentStage === "generating_descriptions") return 20;
    if (currentStage === "generating_images") {
      const imagesGenerated = scenes.filter((s) => s.imageUrl).length;
      return 20 + (imagesGenerated / totalScenes) * 80;
    }
    return 100;
  };

  const progress = getProgress();
  const imagesGenerated = scenes.filter((s) => s.imageUrl).length;

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
            {currentStage === "generating_descriptions"
              ? "Planning scenes and generating visual descriptions..."
              : currentStage === "generating_images"
                ? `Generating images (${imagesGenerated}/${totalScenes})...`
                : "Storyboard complete!"}
          </p>
        </div>

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

          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
            <span className="text-muted-foreground">
              {currentStage === "complete"
                ? "All scenes generated successfully!"
                : `Estimated time remaining: ${Math.ceil((totalScenes - imagesGenerated) * 10)}s`}
            </span>
            <Badge variant="secondary">Using Google Nano Banana</Badge>
          </div>
        </Card>

        {/* Scenes Grid */}
        {scenes.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Scene Generation</h3>
            </div>
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
              ${(totalScenes * 0.04).toFixed(2)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
