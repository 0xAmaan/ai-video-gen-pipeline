"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      .map(([iterationNumber, images]) => ({
        iterationNumber,
        images: images.sort((a, b) => a.variantNumber - b.variantNumber),
        prompt: images[0]?.iterationPrompt,
      }));
  }, [shotData?.images]);

  useEffect(() => {
    if (shotData?.shot.selectedImageId) {
      setSelectedImageId(shotData.shot.selectedImageId);
      return;
    }
    if (!selectedImageId && groupedIterations.length > 0) {
      const firstImage = groupedIterations[0].images[0];
      if (firstImage) {
        setSelectedImageId(firstImage._id);
      }
    }
  }, [
    shotData?.shot.selectedImageId,
    shotId,
    groupedIterations,
    selectedImageId,
  ]);

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
  };

  const handleIterateFromImage = (image: ShotImage) => {
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

      await updateShotImage({
        imageId: selectedImageId,
        isFavorite: true,
      });

      await selectMasterShot({
        projectId,
        sceneId: shotData.scene._id,
        shotId: shotData.shot._id,
        selectedImageId,
      });

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
              <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[var(--color-primary)]"></div>
                <p className="text-xl text-gray-300 font-medium">
                  Generating images...
                </p>
                <p className="text-sm text-gray-500">
                  Creating 3 variations for your shot
                </p>
              </div>
            ) : groupedIterations.length === 0 ? (
              <div className="border border-dashed border-gray-800 rounded-3xl p-12 text-center text-gray-500">
                No preview generated yet. Close this modal and click &quot;Generate previews&quot; first.
              </div>
            ) : (
              groupedIterations.map((iteration, index) => (
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
                    selectedImageId={selectedImageId}
                    onSelectImage={handleSelectImage}
                    onIterateFromImage={handleIterateFromImage}
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
              ))
            )}
          </div>
        </div>

        {/* Modal Footer - Chat Input */}
        <div ref={chatInputRef} className="border-t border-gray-900 px-6 py-4 flex-shrink-0 bg-[#050505]">
          <div className="space-y-2">
            {generationError && (
              <div className="text-sm text-red-400">
                Failed to generate images: {generationError}
              </div>
            )}
            {isGenerating && (
              <div className="text-sm text-gray-400">Generating images...</div>
            )}
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
                  ? "Describe how you'd like to iterate on this image..."
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
