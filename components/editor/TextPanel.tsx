"use client";

import { useState } from "react";
import { ScrollArea } from "../ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
} from "lucide-react";

type TextPreset = {
  id: string;
  name: string;
  description: string;
  category: "title" | "subtitle" | "body" | "caption";
  fontSize: string;
  fontWeight: string;
  textAlign: string;
  icon: string;
};

const TEXT_PRESETS: TextPreset[] = [
  // Title presets
  {
    id: "title-bold",
    name: "Bold Title",
    description: "Large, bold text for main titles",
    category: "title",
    fontSize: "48px",
    fontWeight: "bold",
    textAlign: "center",
    icon: "Heading1",
  },
  {
    id: "title-elegant",
    name: "Elegant Title",
    description: "Refined title with medium weight",
    category: "title",
    fontSize: "42px",
    fontWeight: "medium",
    textAlign: "center",
    icon: "Heading1",
  },
  // Subtitle presets
  {
    id: "subtitle-medium",
    name: "Medium Subtitle",
    description: "Clear subtitle for sections",
    category: "subtitle",
    fontSize: "32px",
    fontWeight: "semibold",
    textAlign: "center",
    icon: "Heading2",
  },
  {
    id: "subtitle-light",
    name: "Light Subtitle",
    description: "Subtle subtitle text",
    category: "subtitle",
    fontSize: "28px",
    fontWeight: "normal",
    textAlign: "left",
    icon: "Heading2",
  },
  // Body presets
  {
    id: "body-default",
    name: "Body Text",
    description: "Standard body text",
    category: "body",
    fontSize: "18px",
    fontWeight: "normal",
    textAlign: "left",
    icon: "Type",
  },
  {
    id: "body-emphasis",
    name: "Emphasized Body",
    description: "Body text with emphasis",
    category: "body",
    fontSize: "20px",
    fontWeight: "medium",
    textAlign: "left",
    icon: "Type",
  },
  // Caption presets
  {
    id: "caption-small",
    name: "Small Caption",
    description: "Small text for captions",
    category: "caption",
    fontSize: "14px",
    fontWeight: "normal",
    textAlign: "center",
    icon: "Quote",
  },
  {
    id: "caption-italic",
    name: "Italic Caption",
    description: "Stylized caption text",
    category: "caption",
    fontSize: "16px",
    fontWeight: "normal",
    textAlign: "center",
    icon: "Quote",
  },
];

interface TextPanelProps {
  onSelectText?: (preset: TextPreset) => void;
  selectedPresetId?: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  List,
};

const TextPresetCard = ({
  preset,
  isSelected,
  onSelect,
}: {
  preset: TextPreset;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const Icon = iconMap[preset.icon] || Type;

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
        {/* Font size badge */}
        <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-sm px-2 py-1 rounded text-white text-xs font-medium">
          {preset.fontSize}
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
            {preset.fontWeight}
          </Badge>
        </div>
        <p className="text-[10px] text-zinc-500 line-clamp-2">
          {preset.description}
        </p>
      </div>
    </button>
  );
};

export const TextPanel = ({
  onSelectText,
  selectedPresetId,
}: TextPanelProps) => {
  const [activeCategory, setActiveCategory] = useState<
    "title" | "subtitle" | "body" | "caption"
  >("title");
  const [selectedId, setSelectedId] = useState<string | undefined>(
    selectedPresetId,
  );

  const getPresetsByCategory = (category: TextPreset["category"]) => {
    return TEXT_PRESETS.filter((preset) => preset.category === category);
  };

  const titlePresets = getPresetsByCategory("title");
  const subtitlePresets = getPresetsByCategory("subtitle");
  const bodyPresets = getPresetsByCategory("body");
  const captionPresets = getPresetsByCategory("caption");

  const handleSelectPreset = (preset: TextPreset) => {
    setSelectedId(preset.id);
    if (onSelectText) {
      onSelectText(preset);
    }
  };

  const renderPresetGrid = (presets: TextPreset[]) => (
    <div className="grid grid-cols-2 gap-2 p-3">
      {presets.map((preset) => (
        <TextPresetCard
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
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
          Text
        </h2>
      </div>

      {/* Category Tabs */}
      <Tabs
        value={activeCategory}
        onValueChange={(value) =>
          setActiveCategory(value as typeof activeCategory)
        }
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="px-3">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="title" className="text-xs">
              Title
            </TabsTrigger>
            <TabsTrigger value="subtitle" className="text-xs">
              Subtitle
            </TabsTrigger>
            <TabsTrigger value="body" className="text-xs">
              Body
            </TabsTrigger>
            <TabsTrigger value="caption" className="text-xs">
              Caption
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="title" className="mt-0">
            {renderPresetGrid(titlePresets)}
          </TabsContent>
          <TabsContent value="subtitle" className="mt-0">
            {renderPresetGrid(subtitlePresets)}
          </TabsContent>
          <TabsContent value="body" className="mt-0">
            {renderPresetGrid(bodyPresets)}
          </TabsContent>
          <TabsContent value="caption" className="mt-0">
            {renderPresetGrid(captionPresets)}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
