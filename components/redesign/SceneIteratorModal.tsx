"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatInput } from "@/components/redesign/ChatInput";
import { IterationRow } from "@/components/redesign/IterationRow";
import { Check, ArrowDown, AlertCircle } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import {
  useShotWithScene,
  useSelectMasterShot,
  useUpdateShotImage,
} from "@/lib/hooks/useProjectRedesign";
import { ShotImage } from "@/lib/types/redesign";
import { cn } from "@/lib/utils";

interface GroupedIteration {
  iterationNumber: number;
  images: ShotImage[];
  prompt?: string;
  parentImage?: ShotImage;
}

interface SceneIteratorModalProps {
  projectId: Id<"videoProjects">;
  shotId: Id<"sceneShots"> | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SceneIteratorModal = ({
  projectId,
  shotId,
  isOpen,
  onClose,
}: SceneIteratorModalProps) => {
  const shotData = useShotWithScene(shotId ?? undefined);
  const selectMasterShot = useSelectMasterShot();
  const updateShotImage = useUpdateShotImage();
  const [selectedImageId, setSelectedImageId] = useState<
    Id<"shotImages"> | null
  >(null);
  const [iterationPrompt, setIterationPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isSubmittingSelection, setIsSubmittingSelection] = useState(false);
  const chatInputRef = useRef<HTMLDivElement | null>(null);
  const pendingIterationRef = useRef<HTMLDivElement | null>(null);

  const groupedIterations = useMemo<GroupedIteration[]>(() => {
    if (!shotData?.images) return [];
    const map = new Map<number, ShotImage[]>();
    shotData.images.forEach((image) => {
      const iteration = map.get(image.iterationNumber) ?? [];
      iteration.push(image);
      map.set(image.iterationNumber, iteration);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([iterationNumber, images]) => {
        const sortedImages = images.sort((a, b) => a.variantNumber - b.variantNumber);
        const parentImageId = sortedImages[0]?.parentImageId;
        const parentImage = parentImageId
          ? shotData.images.find((img) => img._id === parentImageId)
          : undefined;

        return {
          iterationNumber,
          images: sortedImages,
          prompt: sortedImages[0]?.iterationPrompt,
          parentImage,
        };
      });
  }, [shotData?.images]);

  useEffect(() => {
    // Only set initial selection when modal first opens or shot changes
    if (shotData?.shot.selectedImageId && !selectedImageId) {
      setSelectedImageId(shotData.shot.selectedImageId);
      return;
    }
    if (!selectedImageId && groupedIterations.length > 0) {
      const firstImage = groupedIterations[0].images[0];
      if (firstImage) {
        setSelectedImageId(firstImage._id);
      }
    }
  }, [shotId, shotData?.shot.selectedImageId, groupedIterations.length]);

  // Auto-focus chat input when modal opens
  useEffect(() => {
    if (isOpen && selectedImageId) {
      setTimeout(() => {
        const textarea = chatInputRef.current?.querySelector("textarea");
        textarea?.focus();
      }, 300);
    }
  }, [isOpen, selectedImageId]);

  // Auto-scroll to pending iteration skeleton when generation starts
  useEffect(() => {
    if (isGenerating && groupedIterations.length > 0 && pendingIterationRef.current) {
      setTimeout(() => {
        pendingIterationRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest"
        });
      }, 100);
    }
  }, [isGenerating, groupedIterations.length]);

  const triggerGeneration = async (options?: {
    parentImageId?: Id<"shotImages">;
    fixPrompt?: string;
  }) => {
    if (!projectId || !shotData) return;
    try {
      setIsGenerating(true);
      setGenerationError(null);
      const response = await fetch("/api/generate-shot-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          sceneId: shotData.scene._id,
          shotId: shotData.shot._id,
          parentImageId: options?.parentImageId,
          fixPrompt: options?.fixPrompt,
          mode: "iteration",
        }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(
          errorBody?.error ?? "Failed to trigger image generation",
        );
      }
    } catch (error) {
      console.error("Failed to generate shot images:", error);
      setGenerationError(
        error instanceof Error ? error.message : "Unknown error",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Removed auto-generation on modal open - user must use ChatInput to iterate

  const handleSelectImage = (image: ShotImage) => {
    setSelectedImageId(image._id);
    chatInputRef.current?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => {
      const textarea = chatInputRef.current?.querySelector("textarea");
      textarea?.focus();
    }, 250);
  };

  const handleSubmitSelected = async () => {
    if (!selectedImageId || !shotData || !projectId) return;
    try {
      setIsSubmittingSelection(true);

      // Unfavorite all other images
      await Promise.all(
        shotData.images
          .filter((image) => image.isFavorite && image._id !== selectedImageId)
          .map((image) =>
            updateShotImage({
              imageId: image._id,
              isFavorite: false,
            }),
          ),
      );

      // Mark selected image as favorite
      await updateShotImage({
        imageId: selectedImageId,
        isFavorite: true,
      });

      // Update shot's selectedImageId and create storyboard selection
      await selectMasterShot({
        projectId,
        sceneId: shotData.scene._id,
        shotId: shotData.shot._id,
        selectedImageId,
      });

      // Give a small delay to ensure Convex propagates the update
      await new Promise((resolve) => setTimeout(resolve, 100));

      onClose();
    } catch (error) {
      console.error("Failed to submit selection:", error);
    } finally {
      setIsSubmittingSelection(false);
    }
  };

  if (!shotId) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="!w-[90vw] !h-[90vh] !max-w-[90vw] !max-h-[90vh] sm:!max-w-[90vw] bg-[#050505] border-gray-800 p-0 overflow-hidden flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Modal Header */}
        <div className="border-b border-gray-900 px-6 py-4 flex-shrink-0">
          <div className="flex items-start justify-between gap-6 pr-12">
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-gray-500">
                Scene {shotData?.scene.sceneNumber ?? "—"}
              </p>
              <DialogTitle className="text-2xl font-bold text-white">
                {shotData?.scene.title || "Scene Iterator"}
              </DialogTitle>
              <p className="text-sm text-gray-400 mt-1">
                {shotData?.shot.description ||
                  "Select an image, then iterate to refine your master shot"}
              </p>
            </div>

            <Button
              onClick={handleSubmitSelected}
              disabled={!selectedImageId || isSubmittingSelection}
              className={cn(
                "px-6 py-2 rounded-xl font-semibold whitespace-nowrap flex-shrink-0",
                selectedImageId
                  ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white"
                  : "bg-gray-800 text-gray-500 cursor-not-allowed",
              )}
            >
              <Check className="w-4 h-4 mr-2" />
              Submit Selected
            </Button>
          </div>
        </div>

        {/* Modal Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-8 py-6 pb-24">
          <div className="space-y-10 mb-8">
            {groupedIterations.length === 0 && isGenerating ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#111] border border-gray-800 flex items-center justify-center">
                    <Skeleton className="w-4 h-4 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="grid grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="w-full aspect-video rounded-2xl" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500 text-center">
                  Creating 3 variations for your shot...
                </p>
              </div>
            ) : groupedIterations.length === 0 ? (
              <div className="border border-dashed border-gray-800 rounded-3xl p-12 text-center text-gray-500">
                No preview generated yet. Close this modal and click &quot;Generate previews&quot; first.
              </div>
            ) : (
              <>
                {groupedIterations.map((iteration, index) => (
                  <div key={iteration.iterationNumber} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#111] border border-gray-800 flex items-center justify-center text-sm font-semibold text-gray-300">
                        {iteration.iterationNumber}
                      </div>
                      <span className="text-xs text-gray-500">
                        Iteration {iteration.iterationNumber}
                      </span>
                    </div>

                    <IterationRow
                      iterationNumber={iteration.iterationNumber}
                      images={iteration.images}
                      parentImage={iteration.parentImage}
                      selectedImageId={selectedImageId}
                      onSelectImage={handleSelectImage}
                    />

                    {index < groupedIterations.length - 1 && (
                      <div className="flex items-center gap-4">
                        <div className="flex-1 border-t border-gray-900" />
                        <div className="flex items-center gap-3 bg-[#0b0b0b] border border-gray-900 rounded-2xl px-4 py-3">
                          <ArrowDown className="w-4 h-4 text-[var(--color-primary)]" />
                          <span className="text-sm text-gray-300">
                            {groupedIterations[index + 1].prompt ||
                              "Prompt unavailable"}
                          </span>
                        </div>
                        <div className="flex-1 border-t border-gray-900" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Pending iteration skeleton row - shown when generating new iteration */}
                {isGenerating && groupedIterations.length > 0 && (
                  <div ref={pendingIterationRef} className="space-y-4">
                    {/* Prompt divider before new iteration */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1 border-t border-gray-900" />
                      <div className="flex items-center gap-3 bg-[#0b0b0b] border border-gray-900 rounded-2xl px-4 py-3">
                        <ArrowDown className="w-4 h-4 text-[var(--color-primary)]" />
                        <span className="text-sm text-gray-300">
                          Generating new iteration...
                        </span>
                      </div>
                      <div className="flex-1 border-t border-gray-900" />
                    </div>

                    {/* New iteration header */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#111] border border-gray-800 flex items-center justify-center">
                        <Skeleton className="w-4 h-4 rounded-full" />
                      </div>
                      <Skeleton className="h-4 w-24" />
                    </div>

                    {/* Skeleton iteration row */}
                    <div className="w-full">
                      <div className="flex gap-6">
                        {/* Parent image skeleton */}
                        <div className="flex-shrink-0 w-64">
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="w-full aspect-video rounded-xl" />
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="flex items-center justify-center flex-shrink-0">
                          <ArrowDown className="w-6 h-6 text-gray-600 rotate-[-90deg]" />
                        </div>

                        {/* Variants grid skeleton */}
                        <div className="flex-1 grid grid-cols-3 gap-6">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-3">
                              <Skeleton className="w-full aspect-video rounded-xl" />
                              <Skeleton className="h-4 w-20" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Modal Footer - Chat Input */}
        <div className="border-t border-gray-900 flex-shrink-0 bg-[#050505]">
          {/* Status messages */}
          {(generationError || isGenerating) && (
            <div className="px-6 pt-4 pb-2">
              {generationError && (
                <div className="text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Failed to generate images: {generationError}
                </div>
              )}
              {isGenerating && (
                <div className="text-sm text-gray-400 flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  Generating images...
                </div>
              )}
            </div>
          )}

          {/* Chat Input Container */}
          <div ref={chatInputRef} className="px-6 pb-4 pt-4">
            <ChatInput
              onSubmit={(message) => {
                const trimmed = message.trim();
                if (!trimmed || !selectedImageId) return;
                void triggerGeneration({
                  parentImageId: selectedImageId,
                  fixPrompt: trimmed,
                });
                setIterationPrompt("");
              }}
              placeholder={
                selectedImageId
                  ? "Type refinement instructions (e.g., 'remove background', 'make brighter')..."
                  : "Select an image above to iterate..."
              }
              disabled={!selectedImageId || isGenerating}
              initialMessage={iterationPrompt}
              onMessageChange={setIterationPrompt}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
