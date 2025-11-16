"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight } from "lucide-react";

const NewProjectPage = () => {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createProject = useMutation(api.video.createProject);
  const updateLastActivePhase = useMutation(api.video.updateLastActivePhase);

  const handleSubmit = async () => {
    if (!prompt.trim() || isCreating) return;

    try {
      setIsCreating(true);

      // Create project immediately
      const newProjectId = await createProject({ prompt });

      // Update last active phase
      await updateLastActivePhase({
        projectId: newProjectId,
        phase: "prompt",
      });

      // Redirect immediately to the prompt page
      router.push(`/${newProjectId}/prompt`);
    } catch (error) {
      console.error("Error creating project:", error);
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            What video would you like to create?
          </h1>
          <p className="text-lg text-muted-foreground">
            Describe your vision and we'll help bring it to life
          </p>
        </div>

        {/* Prompt Input */}
        <div className="space-y-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A 60-second product demo showcasing our new app's key features..."
            className="min-h-[200px] text-lg resize-none"
            disabled={isCreating}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey && prompt.trim()) {
                handleSubmit();
              }
            }}
          />

          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Press <kbd className="px-2 py-1 bg-muted rounded text-xs">⌘</kbd>{" "}
              + <kbd className="px-2 py-1 bg-muted rounded text-xs">Enter</kbd>{" "}
              to continue
            </p>
            <Button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isCreating}
              size="lg"
              className="gap-2"
            >
              {isCreating ? "Creating..." : "Continue"}
              {!isCreating && <ArrowRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewProjectPage;
