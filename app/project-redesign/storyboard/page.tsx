"use client";

import { useState } from "react";
import { StoryboardScene, generateMockStoryboard } from "@/types/storyboard";
import { StoryboardSceneRow } from "@/components/redesign/StoryboardSceneRow";
import { ChatInput } from "@/components/redesign/ChatInput";
import { PageNavigation } from "@/components/redesign/PageNavigation";
import { Plus } from "lucide-react";

const StoryboardPage = () => {
  const [scenes, setScenes] = useState<StoryboardScene[]>(
    generateMockStoryboard()
  );
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);

  const handleSceneSelect = (sceneId: string) => {
    setScenes((prev) =>
      prev.map((scene) => ({
        ...scene,
        isSelected: scene.id === sceneId,
      }))
    );
    // Clear part selection when switching scenes
    setSelectedPartId(null);
  };

  const handlePartSelect = (partId: string) => {
    setSelectedPartId(partId);
  };

  const handleAddScene = () => {
    const newSceneNumber = scenes.length + 1;
    const newScene: StoryboardScene = {
      id: `scene-${newSceneNumber}`,
      sceneNumber: newSceneNumber,
      title: `Scene ${newSceneNumber}`,
      parts: [],
      isSelected: false,
    };
    setScenes((prev) => [...prev, newScene]);
  };

  const selectedScene = scenes.find((s) => s.isSelected);

  return (
    <div className="min-h-screen bg-black text-white pb-48">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-sm border-b border-gray-800 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Storyboard</h1>
            <p className="text-sm text-gray-400 mt-1">
              {selectedScene
                ? `${selectedScene.title} selected - Use ChatInput below to add new parts`
                : "Select a scene to add parts"}
            </p>
          </div>

          {/* Navigation */}
          <PageNavigation />

          <button
            onClick={handleAddScene}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Scene
          </button>
        </div>
      </div>

      {/* Storyboard Container */}
      <div className="px-8 py-6">
        {scenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <p className="text-lg mb-4">No scenes yet</p>
            <button
              onClick={handleAddScene}
              className="flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              Create First Scene
            </button>
          </div>
        ) : (
          scenes.map((scene) => (
            <StoryboardSceneRow
              key={scene.id}
              scene={scene}
              selectedPartId={selectedPartId}
              onSceneSelect={() => handleSceneSelect(scene.id)}
              onPartSelect={handlePartSelect}
            />
          ))
        )}
      </div>

      {/* Bottom ChatInput */}
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <ChatInput
          onSubmit={(prompt, settings) => {
            if (!selectedScene) {
              alert("Please select a scene first");
              return;
            }

            // Generate new parts based on variation count
            const newParts = Array.from({ length: settings.variationCount }, (_, i) => ({
              id: `part-${selectedScene.id}-${selectedScene.parts.length + i + 1}-${Date.now()}`,
              partNumber: selectedScene.parts.length + i + 1,
              image: `https://picsum.photos/seed/${Date.now()}-${i}/400/300`,
              prompt: prompt,
              color: ["green", "red", "blue", "amber"][Math.floor(Math.random() * 4)] as "green" | "red" | "blue" | "amber",
            }));

            // Add new parts to the selected scene
            setScenes((prev) =>
              prev.map((scene) =>
                scene.id === selectedScene.id
                  ? { ...scene, parts: [...scene.parts, ...newParts] }
                  : scene
              )
            );
          }}
          placeholder={
            selectedScene
              ? `Add parts to ${selectedScene.title}...`
              : "Select a scene first..."
          }
          disabled={!selectedScene}
        />
      </div>
    </div>
  );
};

export default StoryboardPage;

