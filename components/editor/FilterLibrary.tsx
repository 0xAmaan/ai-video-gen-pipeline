"use client";

import { useState } from "react";
import { ScrollArea } from "../ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import {
  FILTER_PRESETS,
  getPresetsByCategory,
  createEffectFromPreset,
  type FilterPreset,
} from "@/lib/editor/filters";
import type { Effect } from "@/lib/editor/types";
import {
  Sparkles,
  Sunset,
  Snowflake,
  Film,
  Droplet,
  Camera,
  Circle,
  CircleDot,
  Video,
} from "lucide-react";

interface FilterLibraryProps {
  onSelectFilter: (effect: Effect) => void;
  selectedPresetId?: string;
}

// Map icon names to Lucide components
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Sunset,
  Snowflake,
  Film,
  Droplet,
  Camera,
  Circle,
  CircleDot,
  Video,
};

const FilterCard = ({
  preset,
  isSelected,
  onSelect,
}: {
  preset: FilterPreset;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const Icon = iconMap[preset.thumbnailIcon] || Circle;

  return (
    <button
      onClick={onSelect}
      className={`group w-full rounded-lg border overflow-hidden text-left transition-all hover:shadow-md cursor-pointer ${
        isSelected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary"
      }`}
    >
      {/* Preview area */}
      <div
        className={`relative aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center transition-colors ${
          isSelected ? "bg-primary/10" : "group-hover:bg-muted/80"
        }`}
      >
        <Icon
          className={`h-12 w-12 transition-all ${
            isSelected
              ? "text-primary"
              : "text-muted-foreground group-hover:text-foreground group-hover:scale-110"
          }`}
        />
        {/* Category badge */}
        <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-sm px-2 py-1 rounded text-white text-xs font-medium">
          {preset.type}
        </div>
      </div>

      {/* Info */}
      <div className="px-2 py-2">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p
            className={`text-xs font-semibold truncate transition-colors ${
              isSelected
                ? "text-primary"
                : "text-foreground group-hover:text-primary"
            }`}
          >
            {preset.name}
          </p>
        </div>
        <p className="text-[10px] text-muted-foreground line-clamp-2">
          {preset.description}
        </p>
      </div>
    </button>
  );
};

export const FilterLibrary = ({
  onSelectFilter,
  selectedPresetId,
}: FilterLibraryProps) => {
  const [activeCategory, setActiveCategory] = useState<
    "filmGrain" | "colorGrading" | "vintage" | "vignette" | "filmLook"
  >("filmGrain");
  const [selectedId, setSelectedId] = useState<string | undefined>(
    selectedPresetId,
  );

  const filmGrainPresets = getPresetsByCategory("filmGrain");
  const colorGradingPresets = getPresetsByCategory("colorGrading");
  const vintagePresets = getPresetsByCategory("vintage");
  const vignettePresets = getPresetsByCategory("vignette");
  const filmLookPresets = getPresetsByCategory("filmLook");

  const handleSelectPreset = (preset: FilterPreset) => {
    setSelectedId(preset.id);
    const effect = createEffectFromPreset(preset.id);
    onSelectFilter(effect);
  };

  const renderPresetGrid = (presets: FilterPreset[]) => (
    <div className="grid grid-cols-2 gap-2 p-3">
      {presets.map((preset) => (
        <FilterCard
          key={preset.id}
          preset={preset}
          isSelected={selectedId === preset.id}
          onSelect={() => handleSelectPreset(preset)}
        />
      ))}
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-muted/20">
      {/* Category Tabs */}
      <Tabs
        value={activeCategory}
        onValueChange={(value) =>
          setActiveCategory(value as typeof activeCategory)
        }
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="px-3 pt-2">
          <TabsList className="w-full grid grid-cols-5 text-[10px]">
            <TabsTrigger value="filmGrain" className="text-xs px-1">
              Grain
            </TabsTrigger>
            <TabsTrigger value="colorGrading" className="text-xs px-1">
              Color
            </TabsTrigger>
            <TabsTrigger value="vintage" className="text-xs px-1">
              Vintage
            </TabsTrigger>
            <TabsTrigger value="vignette" className="text-xs px-1">
              Vignette
            </TabsTrigger>
            <TabsTrigger value="filmLook" className="text-xs px-1">
              Film
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="filmGrain" className="mt-0">
            {renderPresetGrid(filmGrainPresets)}
          </TabsContent>
          <TabsContent value="colorGrading" className="mt-0">
            {renderPresetGrid(colorGradingPresets)}
          </TabsContent>
          <TabsContent value="vintage" className="mt-0">
            {renderPresetGrid(vintagePresets)}
          </TabsContent>
          <TabsContent value="vignette" className="mt-0">
            {renderPresetGrid(vignettePresets)}
          </TabsContent>
          <TabsContent value="filmLook" className="mt-0">
            {renderPresetGrid(filmLookPresets)}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
