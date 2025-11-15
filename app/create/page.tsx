"use client";

import { useState } from "react";
import { InputPhase } from "@/components/InputPhase";
import { StoryboardPhase } from "@/components/StoryboardPhase";
import { GeneratingPhase } from "@/components/GeneratingPhase";
import { EditorPhase } from "@/components/EditorPhase";
import { Check } from "lucide-react";

type Phase = "input" | "storyboard" | "generating" | "editor";

interface VideoProject {
  prompt: string;
  audience: string;
  tone: string;
  duration: string;
  style: string;
  scenes: Scene[];
  videoUrl?: string;
}

interface Scene {
  id: string;
  image: string;
  description: string;
  duration: number;
  order: number;
}

const CreateVideoPage = () => {
  const [currentPhase, setCurrentPhase] = useState<Phase>("input");
  const [project, setProject] = useState<VideoProject | null>(null);

  const handleInputComplete = (data: {
    prompt: string;
    audience: string;
    tone: string;
    duration: string;
    style: string;
  }) => {
    // Generate mock scenes based on input
    const mockScenes: Scene[] = [
      {
        id: "scene-1",
        image:
          "https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=450&fit=crop",
        description:
          "Opening shot: Establish the setting and grab attention with a compelling visual hook",
        duration: 3,
        order: 0,
      },
      {
        id: "scene-2",
        image:
          "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800&h=450&fit=crop",
        description:
          "Introduce the main concept or product with clear, engaging visuals",
        duration: 5,
        order: 1,
      },
      {
        id: "scene-3",
        image:
          "https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=800&h=450&fit=crop",
        description: "Showcase key features or benefits in action",
        duration: 4,
        order: 2,
      },
      {
        id: "scene-4",
        image:
          "https://images.unsplash.com/photo-1557682268-e3955ed5d83f?w=800&h=450&fit=crop",
        description: "Demonstrate real-world application or use case",
        duration: 4,
        order: 3,
      },
      {
        id: "scene-5",
        image:
          "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800&h=450&fit=crop",
        description: "Closing shot: Call to action and memorable final message",
        duration: 3,
        order: 4,
      },
    ];

    setProject({
      ...data,
      scenes: mockScenes,
    });
    setCurrentPhase("storyboard");
  };

  const handleGenerateVideo = (scenes: Scene[]) => {
    setProject((prev) => (prev ? { ...prev, scenes } : null));
    setCurrentPhase("generating");
  };

  const handleGenerationComplete = () => {
    // TODO: Set video URL from generation
    setProject((prev) =>
      prev ? { ...prev, videoUrl: "mock-video-url" } : null,
    );
    setCurrentPhase("editor");
  };

  const handleExport = () => {
    // TODO: Export functionality
    console.log("Exporting video...");
  };

  return (
    <div className="min-h-screen bg-background-base">
      {/* Phase Indicator */}
      <PhaseIndicator
        currentPhase={currentPhase}
        onPhaseClick={setCurrentPhase}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {currentPhase === "input" && (
          <InputPhase onComplete={handleInputComplete} />
        )}

        {currentPhase === "storyboard" && project && (
          <StoryboardPhase
            prompt={project.prompt}
            scenes={project.scenes}
            onGenerateVideo={handleGenerateVideo}
          />
        )}

        {currentPhase === "generating" && (
          <GeneratingPhase onComplete={handleGenerationComplete} />
        )}

        {currentPhase === "editor" && project?.videoUrl && (
          <EditorPhase videoUrl={project.videoUrl} onExport={handleExport} />
        )}
      </div>
    </div>
  );
};

interface PhaseIndicatorProps {
  currentPhase: Phase;
  onPhaseClick: (phase: Phase) => void;
}

const PhaseIndicator = ({
  currentPhase,
  onPhaseClick,
}: PhaseIndicatorProps) => {
  const phases: { id: Phase; label: string }[] = [
    { id: "input", label: "Input" },
    { id: "storyboard", label: "Storyboard" },
    { id: "generating", label: "Generate" },
    { id: "editor", label: "Edit" },
  ];

  const currentIndex = phases.findIndex((p) => p.id === currentPhase);

  return (
    <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-5">
        <div className="flex items-center justify-center gap-2">
          {phases.map((phase, index) => (
            <div key={phase.id} className="flex items-center">
              <button
                onClick={() => onPhaseClick(phase.id)}
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                    index < currentIndex
                      ? "bg-primary border-primary text-primary-foreground"
                      : index === currentIndex
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {index < currentIndex ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    index === currentIndex
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {phase.label}
                </span>
              </button>
              {index < phases.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 ${
                    index < currentIndex ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CreateVideoPage;
