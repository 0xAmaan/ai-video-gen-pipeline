"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";

interface CharacterVariation {
  model: string;
  modelName: string;
  imageUrl: string;
  cost: number;
}

export default function CharacterSelectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.projectId as string;

  const [variations, setVariations] = useState<CharacterVariation[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get project data including questionnaire responses
  const projectData = useQuery(api.video.getProjectWithAllData, {
    projectId: projectId as Id<"videoProjects">,
  });

  // Mutation to save the selected character reference
  // TEMPORARY: Using updateProjectStatus instead since saveCharacterReference isn't deployed
  const updateProjectStatus = useMutation(api.video.updateProjectStatus);

  // Ref to track if generation has been initiated (prevents duplicate calls)
  const hasInitiatedGeneration = useRef(false);

  // Generate variations when page loads
  useEffect(() => {
    const generateVariations = async () => {
      // Guard: only run once
      if (hasInitiatedGeneration.current) {
        return;
      }

      if (!projectData?.questions?.answers) {
        return;
      }

      hasInitiatedGeneration.current = true;

      try {
        setError(null);
        // Use the actual video prompt from the project
        const videoPrompt =
          projectData.questions.answers.prompt ||
          "A character in a cinematic scene";

        console.log(
          "📹 Using video prompt for character generation:",
          videoPrompt,
        );
        console.log(
          "📋 Questionnaire responses:",
          projectData.questions.answers.responses,
        );

        const response = await apiFetch("/api/generate-character-variations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId: projectId,
            scenePrompt: videoPrompt,
            responses: projectData.questions.answers.responses,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.details || "Failed to generate variations");
        }

        if (data.success) {
          setVariations(data.variations);
          console.log(
            `✅ Generated ${data.variations.length} character variations`,
          );

          // Log warning if some models failed
          if (data.failedModels && data.failedModels.length > 0) {
            console.warn(
              `⚠️ ${data.failedModels.length} model(s) failed:`,
              data.failedModels,
            );
          }
        } else {
          throw new Error("No variations generated");
        }
      } catch (error) {
        console.error("❌ Failed to generate variations:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to generate character variations";
        setError(errorMessage);
        // On error, allow retry
        hasInitiatedGeneration.current = false;
      } finally {
        setIsLoading(false);
      }
    };

    generateVariations();
  }, [projectData?.questions?.answers]);

  const retryGeneration = () => {
    setIsLoading(true);
    setError(null);
    // This will trigger the useEffect to re-run
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Choose Your Character Style
          </h1>
          <p className="text-muted-foreground">
            Select the look that best matches your vision. This will be used as
            reference for all scenes.
          </p>
        </div>

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-destructive text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold mb-2">Generation Failed</h2>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              {error}
            </p>
            <Button onClick={retryGeneration}>Try Again</Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg text-muted-foreground">
              Generating character variations...
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This should take about 5-10 seconds
            </p>
          </div>
        )}

        {/* Variations Grid */}
        {!isLoading && !error && variations.length > 0 && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {variations.map((variation, index) => (
                <Card
                  key={index}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedIndex === index
                      ? "ring-2 ring-primary shadow-xl"
                      : "hover:ring-1 hover:ring-primary/50"
                  }`}
                  onClick={() => setSelectedIndex(index)}
                >
                  <div className="aspect-square relative overflow-hidden rounded-t-lg bg-muted">
                    <img
                      src={variation.imageUrl}
                      alt={`${variation.modelName} - Variation ${index + 1}`}
                      className="w-full h-full object-cover transition-transform hover:scale-105"
                    />
                    <Badge className="absolute top-3 left-3 bg-black/70 text-white border-none">
                      {variation.modelName}
                    </Badge>
                    {selectedIndex === index && (
                      <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                        <div className="bg-primary text-primary-foreground rounded-full p-3">
                          <Check className="w-6 h-6" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Style {index + 1}
                      </span>
                      {selectedIndex === index && (
                        <Badge variant="default">✓ Selected</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Success Message */}
            {successMessage && (
              <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200 text-center">
                  ✓ {successMessage}
                </p>
              </div>
            )}

            {/* Continue Button */}
            <div className="flex justify-center">
              <Button
                size="lg"
                disabled={selectedIndex === null || isSaving}
                onClick={async () => {
                  if (selectedIndex === null) return;

                  const selectedVariation = variations[selectedIndex];
                  setIsSaving(true);

                  try {
                    // TEMPORARY: Store in localStorage until mutation is deployed
                    const characterData = {
                      referenceImageUrl: selectedVariation.imageUrl,
                      selectedModel: selectedVariation.model,
                    };
                    localStorage.setItem(
                      `character-${projectId}`,
                      JSON.stringify(characterData),
                    );

                    // Update project status
                    await updateProjectStatus({
                      projectId: projectId as Id<"videoProjects">,
                      status: "questions_answered", // Use existing status
                    });

                    console.log(
                      `✅ Character saved: ${selectedVariation.modelName}`,
                    );
                    console.log("📦 Stored in localStorage:", characterData);
                    setSuccessMessage(
                      `Using ${selectedVariation.modelName} as your character reference`,
                    );

                    // Navigate to storyboard after short delay to show success
                    setTimeout(() => {
                      router.push(`/${projectId}/storyboard`);
                    }, 500);
                  } catch (error) {
                    console.error("❌ Failed to save character:", error);
                    setError(
                      "Could not save character reference. Please try again.",
                    );
                    setIsSaving(false);
                  }
                }}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Continue with Selected Character"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
