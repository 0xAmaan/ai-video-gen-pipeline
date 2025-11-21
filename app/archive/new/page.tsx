"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceDictationButton } from "@/components/ui/voice-dictation-button";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";
import { ArrowRight } from "lucide-react";

const NewProjectPage = () => {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createProject = useMutation(api.video.createProject);
  const updateLastActivePhase = useMutation(api.video.updateLastActivePhase);

  // Voice dictation
  const {
    isListening,
    isSupported,
    transcript,
    toggleListening,
    resetTranscript,
  } = useVoiceDictation();

  // Update prompt with voice transcript
  useEffect(() => {
    if (transcript) {
      setPrompt(transcript);
    }
  }, [transcript]);

  // Reset transcript when prompt is manually cleared
  useEffect(() => {
    if (!prompt && transcript) {
      resetTranscript();
    }
  }, [prompt, transcript, resetTranscript]);

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
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
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
          <div className="relative">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., A 60-second product demo showcasing our new app's key features..."
              className="min-h-[200px] text-lg resize-none focus-visible:ring-0 focus-visible:border-primary p-4 pr-16"
              disabled={isCreating || isListening}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey && prompt.trim()) {
                  handleSubmit();
                }
              }}
            />
            <div className="absolute top-4 right-4">
              <VoiceDictationButton
                isListening={isListening}
                isSupported={isSupported}
                onToggle={toggleListening}
                disabled={isCreating}
                size="default"
              />
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {isListening ? (
                <span className="text-red-500 font-medium">
                  🔴 Recording... Click the mic to stop
                </span>
              ) : (
                <>
                  Press{" "}
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">⌘</kbd> +{" "}
                  <kbd className="px-2 py-1 bg-muted rounded text-xs">
                    Enter
                  </kbd>{" "}
                  to continue
                </>
              )}
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
