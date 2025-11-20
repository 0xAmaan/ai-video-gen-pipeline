"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceDictationButton } from "@/components/ui/voice-dictation-button";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";
import { ArrowRight, Sparkles, Lightbulb } from "lucide-react";

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

  const examplePrompts = [
    "A 60-second product demo showcasing our new app's key features",
    "An engaging tutorial explaining how to use our platform",
    "A promotional video highlighting our company's mission and values",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--bg-base)] via-[var(--bg-surface-dark)] to-[var(--bg-base)] flex flex-col items-center justify-center px-4 py-12">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      <div className="w-full max-w-3xl space-y-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              AI Video Creation
            </span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-white">
            What video would you like to create?
          </h1>
          <p className="text-xl text-gray-400">
            Describe your vision and we'll help bring it to life
          </p>
        </motion.div>

        {/* Main Input Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-surface-dark)] border border-gray-700/50 rounded-2xl p-8 shadow-2xl"
        >
          <div className="space-y-6">
            <div className="relative">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your video idea in detail..."
                className="min-h-[200px] text-lg resize-none bg-[var(--bg-base)] border-gray-700 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary p-6 pr-16 text-white placeholder:text-gray-500"
                disabled={isCreating || isListening}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey && prompt.trim()) {
                    (async () => {
                      if (!prompt.trim() || isCreating) return;
                      try {
                        setIsCreating(true);
                        const newProjectId = await createProject({ prompt });
                        await updateLastActivePhase({
                          projectId: newProjectId,
                          phase: "prompt",
                        });
                        router.push(`/${newProjectId}/prompt`);
                      } catch (error) {
                        console.error("Error creating project:", error);
                        setIsCreating(false);
                      }
                    })();
                  }
                }}
              />
              <div className="absolute top-6 right-6">
                <VoiceDictationButton
                  isListening={isListening}
                  isSupported={isSupported}
                  onToggle={toggleListening}
                  disabled={isCreating}
                  size="default"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="text-sm text-gray-400">
                {isListening ? (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-red-400 font-medium"
                  >
                    <motion.span
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-2 h-2 bg-red-500 rounded-full"
                    />
                    Recording... Click the mic to stop
                  </motion.span>
                ) : (
                  <>
                    Press{" "}
                    <kbd className="px-2 py-1 bg-gray-700/50 rounded text-xs border border-gray-600">
                      ⌘
                    </kbd>{" "}
                    +{" "}
                    <kbd className="px-2 py-1 bg-gray-700/50 rounded text-xs border border-gray-600">
                      Enter
                    </kbd>{" "}
                    to continue
                  </>
                )}
              </div>
              <Button
                onClick={() => {
                  (async () => {
                    if (!prompt.trim() || isCreating) return;
                    try {
                      setIsCreating(true);
                      const newProjectId = await createProject({ prompt });
                      await updateLastActivePhase({
                        projectId: newProjectId,
                        phase: "prompt",
                      });
                      router.push(`/${newProjectId}/prompt`);
                    } catch (error) {
                      console.error("Error creating project:", error);
                      setIsCreating(false);
                    }
                  })();
                }}
                disabled={!prompt.trim() || isCreating}
                size="lg"
                className="gap-2 bg-primary hover:bg-primary/90 text-white px-8 group"
              >
                {isCreating ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    />
                    Creating...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Example Prompts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2 text-gray-400">
            <Lightbulb className="w-4 h-4" />
            <span className="text-sm font-medium">Need inspiration? Try these:</span>
          </div>
          <div className="grid gap-3">
            {examplePrompts.map((example, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                onClick={() => setPrompt(example)}
                className="text-left p-4 rounded-xl bg-[var(--bg-surface)]/50 border border-gray-700/50 hover:border-primary/50 hover:bg-[var(--bg-surface)] transition-all duration-300 group"
                disabled={isCreating}
              >
                <p className="text-sm text-gray-300 group-hover:text-white transition-colors">
                  {example}
                </p>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default NewProjectPage;
