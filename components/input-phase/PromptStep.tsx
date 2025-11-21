"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceDictationButton } from "@/components/ui/voice-dictation-button";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";
import { ArrowRight } from "lucide-react";

interface PromptStepProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  onSubmit: () => void;
  error: string | null;
}

export const PromptStep = ({
  prompt,
  setPrompt,
  onSubmit,
  error,
}: PromptStepProps) => {
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
  }, [transcript, setPrompt]);

  // Reset transcript when prompt is manually cleared
  useEffect(() => {
    if (!prompt && transcript) {
      resetTranscript();
    }
  }, [prompt, transcript, resetTranscript]);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="w-full max-w-3xl px-4">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-3">Create Your Video</h1>
          <p className="text-lg text-muted-foreground">
            Start by describing what you want to create
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 shadow-xl shadow-black/40">
          <label
            htmlFor="prompt"
            className="block text-xl font-semibold mb-4 text-center"
          >
            What video would you like to create?
          </label>
          <div className="relative">
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: A product demo video showcasing our new mobile app's key features like real-time collaboration and smart notifications..."
              className="min-h-[160px] text-base resize-none bg-input border-border/60 p-4 pr-16"
              autoFocus
              disabled={isListening}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey && prompt.trim()) {
                  onSubmit();
                }
              }}
            />
            <div className="absolute top-4 right-4">
              <VoiceDictationButton
                isListening={isListening}
                isSupported={isSupported}
                onToggle={toggleListening}
                size="default"
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              {isListening ? (
                <span className="text-red-500 font-medium">
                  🔴 Recording... Click the mic to stop
                </span>
              ) : (
                "Be specific about key points, features, or messages you want to convey"
              )}
            </p>
            <Button
              onClick={onSubmit}
              disabled={!prompt.trim()}
              size="lg"
              className="bg-primary hover:bg-primary/90"
            >
              Continue
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
          {error && (
            <p className="text-sm text-destructive mt-3 text-center">
              {error}
            </p>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {isListening
            ? "Recording in progress..."
            : "Press ⌘+Enter to continue"}
        </p>
      </div>
    </div>
  );
};

