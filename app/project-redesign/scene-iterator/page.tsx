"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { IterationRow } from "@/components/redesign/IterationRow";
import { ChatInput } from "@/components/redesign/ChatInput";
import { PageNavigation } from "@/components/redesign/PageNavigation";
import { Check, ArrowDown } from "lucide-react";

interface Iteration {
  id: number;
  images: string[]; // Array of 6 image URLs
  iterationPrompt?: string; // The prompt used to create this iteration from the previous one
}

const IteratorPage = () => {
  const [iterations, setIterations] = useState<Iteration[]>([
    {
      id: 1,
      images: ["", "", "", "", "", ""], // 6 empty placeholders
    },
  ]);

  const [selectedIteration, setSelectedIteration] = useState<{
    iterationId: number;
    imageIndex: number;
  } | null>(null);

  const [iterationPrompt, setIterationPrompt] = useState("");
  const chatInputRef = useRef<HTMLDivElement>(null);

  const handleSelectImage = (iterationNumber: number, imageIndex: number) => {
    setSelectedIteration({
      iterationId: iterationNumber,
      imageIndex,
    });
  };

  const handleIterateFromImage = (
    iterationNumber: number,
    imageIndex: number
  ) => {
    // Select the image
    setSelectedIteration({
      iterationId: iterationNumber,
      imageIndex,
    });

    // Focus on the chat input
    chatInputRef.current?.scrollIntoView({ behavior: "smooth" });

    // Focus the textarea inside ChatInput
    setTimeout(() => {
      const textarea = chatInputRef.current?.querySelector("textarea");
      textarea?.focus();
    }, 300);
  };

  const handleChatSubmit = (
    message: string,
    settings: {
      mode: "image" | "video";
      model: string;
      audioOn: boolean;
      duration: string;
      quality: string;
      aspectRatio: string;
      variationCount: number;
    }
  ) => {
    if (!selectedIteration) return;

    // Create new iteration
    const newId = Math.max(...iterations.map((i) => i.id), 0) + 1;
    const newIteration: Iteration = {
      id: newId,
      images: Array(6).fill(""), // 6 empty placeholders
      iterationPrompt: message,
    };

    setIterations((prev) => [...prev, newIteration]);
    setIterationPrompt("");

    console.log("Generating new iteration:", {
      fromIteration: selectedIteration.iterationId,
      fromImageIndex: selectedIteration.imageIndex,
      prompt: message,
      settings,
    });

    // TODO: Implement actual generation logic
    // This will call your image generation API with the selected image and prompt
  };

  const handleSubmitSelected = () => {
    if (!selectedIteration) return;

    const iteration = iterations.find(
      (i) => i.id === selectedIteration.iterationId
    );
    if (!iteration) return;

    const selectedImageUrl = iteration.images[selectedIteration.imageIndex];

    console.log("Submitting selected image:", {
      iterationId: selectedIteration.iterationId,
      imageIndex: selectedIteration.imageIndex,
      imageUrl: selectedImageUrl,
    });

    // TODO: Implement actual submit logic
    // This will save the selected image as the master shot
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] w-full pb-48">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">
              Scene Iterator
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Select an image, then iterate to refine your master shot
            </p>
          </div>

          {/* Navigation */}
          <PageNavigation />

          <Button
            onClick={handleSubmitSelected}
            disabled={!selectedIteration}
            className={`
              px-6 py-2 rounded-xl font-semibold
              ${
                selectedIteration
                  ? "bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white"
                  : "bg-gray-800 text-gray-500 cursor-not-allowed"
              }
            `}
          >
            <Check className="w-4 h-4 mr-2" />
            Submit Selected
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {iterations.map((iteration, index) => (
          <div key={iteration.id}>
            {/* Iteration Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#171717] border border-gray-800 flex items-center justify-center text-sm font-semibold text-gray-400">
                {iteration.id}
              </div>
              <span className="text-xs text-gray-500">
                Iteration {iteration.id}
              </span>
            </div>

            {/* Iteration Row */}
            <IterationRow
              iterationNumber={iteration.id}
              images={iteration.images}
              selectedImageIndex={
                selectedIteration?.iterationId === iteration.id
                  ? selectedIteration.imageIndex
                  : null
              }
              onSelectImage={handleSelectImage}
              onIterateFromImage={handleIterateFromImage}
            />

            {/* Iteration Prompt Text - shown between rows */}
            {index < iterations.length - 1 && (
              <div className="mt-8 mb-8 flex items-center gap-4">
                <div className="flex-1 border-t border-gray-800" />
                <div className="flex items-center gap-3 bg-[#171717] border border-gray-800 rounded-xl px-4 py-3">
                  <ArrowDown className="w-4 h-4 text-[var(--color-primary)]" />
                  <span className="text-sm text-gray-300">
                    {iterations[index + 1].iterationPrompt || "No prompt"}
                  </span>
                </div>
                <div className="flex-1 border-t border-gray-800" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ChatInput - Fixed at bottom */}
      <div ref={chatInputRef}>
        <ChatInput
          onSubmit={handleChatSubmit}
          placeholder={
            selectedIteration
              ? "Describe how you want to iterate on this image..."
              : "Select an image first, then enter your iteration prompt..."
          }
          disabled={!selectedIteration}
          initialMessage={iterationPrompt}
          onMessageChange={setIterationPrompt}
        />
      </div>
    </div>
  );
};

export default IteratorPage;
