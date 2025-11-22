"use client";

import { useState } from "react";
import { ScrollArea } from "../ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import {
  TRANSITION_PRESETS,
  getPresetsByCategory,
  createTransitionFromPreset,
  type TransitionPreset,
  type EasingFunction,
} from "@/lib/editor/transitions";
import type { TransitionSpec } from "@/lib/editor/types";
import {
  Circle,
  Droplets,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  MoveLeft,
  MoveRight,
  MoveUp,
  MoveDown,
  ZoomIn,
  ZoomOut,
  Clock,
} from "lucide-react";

interface TransitionLibraryProps {
  onSelectTransition: (transition: TransitionSpec) => void;
  selectedPresetId?: string;
}

// Map icon names to Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Circle,
  Droplets,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  MoveLeft,
  MoveRight,
  MoveUp,
  MoveDown,
  ZoomIn,
  ZoomOut,
};

const formatDuration = (seconds: number) => {
  if (seconds < 1) {
    return `${(seconds * 1000).toFixed(0)}ms`;
  }
  return `${seconds.toFixed(1)}s`;
};

const TransitionCard = ({
  preset,
  isSelected,
  onSelect,
}: {
  preset: TransitionPreset;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const Icon = iconMap[preset.thumbnailIcon] || Circle;

  return (
    <button
      onClick={onSelect}
      className={`group w-full rounded-lg border overflow-hidden text-left transition-all hover:shadow-md cursor-pointer ${
        isSelected
          ? "border-blue-500 bg-blue-500/10 shadow-md"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
      }`}
    >
      {/* Preview area */}
      <div
        className={`relative aspect-video bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center transition-colors ${
          isSelected ? "bg-blue-500/10" : "group-hover:bg-zinc-800"
        }`}
      >
        <Icon
          className={`h-12 w-12 transition-all ${
            isSelected
              ? "text-blue-400"
              : "text-zinc-500 group-hover:text-zinc-300 group-hover:scale-110"
          }`}
        />
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/75 backdrop-blur-sm px-2 py-1 rounded text-white text-xs font-medium">
          <Clock className="h-3 w-3" />
          {formatDuration(preset.defaultDuration)}
        </div>
      </div>

      {/* Info */}
      <div className="px-2 py-2">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p
            className={`text-xs font-semibold truncate transition-colors ${
              isSelected
                ? "text-blue-400"
                : "text-zinc-200 group-hover:text-blue-400"
            }`}
          >
            {preset.name}
          </p>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-zinc-700 text-zinc-400">
            {preset.defaultEasing}
          </Badge>
        </div>
        <p className="text-[10px] text-zinc-500 line-clamp-2">
          {preset.description}
        </p>
      </div>
    </button>
  );
};

export const TransitionLibrary = ({
  onSelectTransition,
  selectedPresetId,
}: TransitionLibraryProps) => {
  const [activeCategory, setActiveCategory] = useState<
    "fade" | "wipe" | "slide" | "zoom"
  >("fade");
  const [selectedId, setSelectedId] = useState<string | undefined>(
    selectedPresetId,
  );

  const fadePresets = getPresetsByCategory("fade");
  const wipePresets = getPresetsByCategory("wipe");
  const slidePresets = getPresetsByCategory("slide");
  const zoomPresets = getPresetsByCategory("zoom");

  const handleSelectPreset = (preset: TransitionPreset) => {
    setSelectedId(preset.id);
    const transitionSpec = createTransitionFromPreset(preset.id);
    onSelectTransition(transitionSpec);
  };

  const renderPresetGrid = (presets: TransitionPreset[]) => (
    <div className="grid grid-cols-2 gap-2 p-3">
      {presets.map((preset) => (
        <TransitionCard
          key={preset.id}
          preset={preset}
          isSelected={selectedId === preset.id}
          onSelect={() => handleSelectPreset(preset)}
        />
      ))}
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Category Tabs */}
      <Tabs
        value={activeCategory}
        onValueChange={(value) =>
          setActiveCategory(value as typeof activeCategory)
        }
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="px-3 pt-2">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="fade" className="text-xs">
              Fade
            </TabsTrigger>
            <TabsTrigger value="wipe" className="text-xs">
              Wipe
            </TabsTrigger>
            <TabsTrigger value="slide" className="text-xs">
              Slide
            </TabsTrigger>
            <TabsTrigger value="zoom" className="text-xs">
              Zoom
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="fade" className="mt-0">
            {renderPresetGrid(fadePresets)}
          </TabsContent>
          <TabsContent value="wipe" className="mt-0">
            {renderPresetGrid(wipePresets)}
          </TabsContent>
          <TabsContent value="slide" className="mt-0">
            {renderPresetGrid(slidePresets)}
          </TabsContent>
          <TabsContent value="zoom" className="mt-0">
            {renderPresetGrid(zoomPresets)}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
