"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Subtitles,
  Wand2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Palette,
} from "lucide-react";

type CaptionStyle = {
  id: string;
  name: string;
  description: string;
  category: "style" | "position" | "animation";
  backgroundColor: string;
  textColor: string;
  position: string;
  icon: string;
};

const CAPTION_STYLES: CaptionStyle[] = [
  // Style presets
  {
    id: "classic",
    name: "Classic",
    description: "Traditional white text on black",
    category: "style",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    textColor: "#ffffff",
    position: "bottom",
    icon: "Subtitles",
  },
  {
    id: "modern",
    name: "Modern",
    description: "Clean white text without background",
    category: "style",
    backgroundColor: "transparent",
    textColor: "#ffffff",
    position: "bottom",
    icon: "Type",
  },
  {
    id: "outlined",
    name: "Outlined",
    description: "White text with black outline",
    category: "style",
    backgroundColor: "transparent",
    textColor: "#ffffff",
    position: "bottom",
    icon: "Type",
  },
  {
    id: "colorful",
    name: "Colorful",
    description: "Bright text on gradient background",
    category: "style",
    backgroundColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    textColor: "#ffffff",
    position: "bottom",
    icon: "Palette",
  },
  // Position presets
  {
    id: "bottom-center",
    name: "Bottom Center",
    description: "Centered at the bottom",
    category: "position",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    textColor: "#ffffff",
    position: "bottom-center",
    icon: "AlignCenter",
  },
  {
    id: "top-center",
    name: "Top Center",
    description: "Centered at the top",
    category: "position",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    textColor: "#ffffff",
    position: "top-center",
    icon: "AlignCenter",
  },
  {
    id: "middle-center",
    name: "Middle Center",
    description: "Centered in the middle",
    category: "position",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    textColor: "#ffffff",
    position: "middle-center",
    icon: "AlignCenter",
  },
  // Animation presets
  {
    id: "fade-in",
    name: "Fade In",
    description: "Smooth fade in effect",
    category: "animation",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    textColor: "#ffffff",
    position: "bottom",
    icon: "Wand2",
  },
  {
    id: "slide-up",
    name: "Slide Up",
    description: "Slide up from bottom",
    category: "animation",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    textColor: "#ffffff",
    position: "bottom",
    icon: "Wand2",
  },
  {
    id: "typewriter",
    name: "Typewriter",
    description: "Character by character reveal",
    category: "animation",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    textColor: "#ffffff",
    position: "bottom",
    icon: "Wand2",
  },
];

interface CaptionsPanelProps {
  onSelectStyle?: (style: CaptionStyle) => void;
  onGenerateCaptions?: () => void;
  selectedStyleId?: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Subtitles,
  Wand2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Palette,
};

const CaptionStyleCard = ({
  style,
  isSelected,
  onSelect,
}: {
  style: CaptionStyle;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const Icon = iconMap[style.icon] || Subtitles;

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
        {/* Position badge */}
        <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-sm px-2 py-1 rounded text-white text-xs font-medium">
          {style.position}
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
            {style.name}
          </p>
        </div>
        <p className="text-[10px] text-zinc-500 line-clamp-2">
          {style.description}
        </p>
      </div>
    </button>
  );
};

export const CaptionsPanel = ({
  onSelectStyle,
  onGenerateCaptions,
  selectedStyleId,
}: CaptionsPanelProps) => {
  const [activeCategory, setActiveCategory] = useState<
    "style" | "position" | "animation"
  >("style");
  const [selectedId, setSelectedId] = useState<string | undefined>(
    selectedStyleId,
  );

  const getStylesByCategory = (category: CaptionStyle["category"]) => {
    return CAPTION_STYLES.filter((style) => style.category === category);
  };

  const stylePresets = getStylesByCategory("style");
  const positionPresets = getStylesByCategory("position");
  const animationPresets = getStylesByCategory("animation");

  const handleSelectStyle = (style: CaptionStyle) => {
    setSelectedId(style.id);
    if (onSelectStyle) {
      onSelectStyle(style);
    }
  };

  const renderStyleGrid = (styles: CaptionStyle[]) => (
    <div className="grid grid-cols-2 gap-2 p-3">
      {styles.map((style) => (
        <CaptionStyleCard
          key={style.id}
          style={style}
          isSelected={selectedId === style.id}
          onSelect={() => handleSelectStyle(style)}
        />
      ))}
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Header with Auto-Generate Button */}
      <div className="px-3 pt-3 pb-2">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
          Captions
        </h2>
        <button
          onClick={onGenerateCaptions}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-cyan-400 font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors border border-zinc-700 cursor-pointer"
        >
          <Wand2 className="w-5 h-5" />
          <span>Auto-Generate Captions</span>
        </button>
      </div>

      {/* Category Tabs */}
      <Tabs
        value={activeCategory}
        onValueChange={(value) =>
          setActiveCategory(value as typeof activeCategory)
        }
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="px-3 pt-2">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="style" className="text-xs">
              Style
            </TabsTrigger>
            <TabsTrigger value="position" className="text-xs">
              Position
            </TabsTrigger>
            <TabsTrigger value="animation" className="text-xs">
              Animation
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="style" className="mt-0">
            {renderStyleGrid(stylePresets)}
          </TabsContent>
          <TabsContent value="position" className="mt-0">
            {renderStyleGrid(positionPresets)}
          </TabsContent>
          <TabsContent value="animation" className="mt-0">
            {renderStyleGrid(animationPresets)}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
