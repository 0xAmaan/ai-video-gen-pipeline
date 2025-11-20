"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Zap,
  DollarSign,
  Sparkles,
  Rocket,
  Scale,
  Gauge,
} from "lucide-react";
import {
  getDemoMode,
  setDemoMode,
  initDemoMode,
  isDevelopment,
  type DemoMode,
} from "@/lib/demo-mode";
import { useModelStore, type ModelPreset } from "@/lib/stores/modelStore";
import {
  TEXT_TO_TEXT_MODELS,
  TEXT_TO_IMAGE_MODELS,
  IMAGE_TO_VIDEO_MODELS,
  SPEED_INDICATORS,
  COST_INDICATORS,
} from "@/lib/types/models";

export const DeveloperToolsMenu = () => {
  const [mounted, setMounted] = useState(false);
  const [demoMode, setDemoModeState] = useState<DemoMode>("off");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Model store state
  const modelSelectionEnabled = useModelStore(
    (state) => state.modelSelectionEnabled,
  );
  const modelPreset = useModelStore((state) => state.modelPreset);
  const setModelPreset = useModelStore((state) => state.setModelPreset);
  const textToTextModel = useModelStore((state) => state.textToTextModel);
  const textToImageModel = useModelStore((state) => state.textToImageModel);
  const imageToVideoModel = useModelStore((state) => state.imageToVideoModel);
  const setTextToTextModel = useModelStore((state) => state.setTextToTextModel);
  const setTextToImageModel = useModelStore(
    (state) => state.setTextToImageModel,
  );
  const setImageToVideoModel = useModelStore(
    (state) => state.setImageToVideoModel,
  );

  useEffect(() => {
    setMounted(true);
    initDemoMode();
    setDemoModeState(getDemoMode());
  }, []);

  const handleDemoModeChange = (newMode: DemoMode) => {
    setDemoMode(newMode);
    setDemoModeState(newMode);
    console.log(`[Demo Mode] Switched to: ${newMode}`);
  };

  const handlePresetChange = (preset: ModelPreset, shouldClose = true) => {
    setModelPreset(preset);
    console.log(`[Model Preset] Switched to: ${preset}`);
    // Don't close dropdown if switching to custom (user needs to select individual models)
    if (preset !== "custom" && shouldClose) {
      setDropdownOpen(false);
    }
  };

  const handleIndividualModelChange = (
    type: "text" | "image" | "video",
    modelId: string,
  ) => {
    // When user changes individual model, switch to custom preset
    if (modelPreset !== "custom") {
      setModelPreset("custom");
    }

    switch (type) {
      case "text":
        setTextToTextModel(modelId);
        break;
      case "image":
        setTextToImageModel(modelId);
        break;
      case "video":
        setImageToVideoModel(modelId);
        break;
    }
  };

  const handlePresetClick = (preset: ModelPreset, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handlePresetChange(preset);
  };

  // Only render in development
  if (!mounted || !isDevelopment()) {
    return null;
  }

  const getDemoModeConfig = (m: DemoMode) => {
    switch (m) {
      case "no-cost":
        return {
          label: "No-Cost (Mock)",
          icon: Zap,
          color: "bg-green-500/20 text-green-600 border-green-500/30",
          description: "Instant mock responses, zero API costs",
        };
      case "cheap":
        return {
          label: "Cheap Inference",
          icon: DollarSign,
          color: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
          description: "Fastest/cheapest models for real inference",
        };
      case "real":
        return {
          label: "Real (Production)",
          icon: Sparkles,
          color: "bg-blue-500/20 text-blue-600 border-blue-500/30",
          description: "Production-quality models",
        };
      default:
        return {
          label: "Off",
          icon: Settings,
          color: "bg-muted text-muted-foreground border-border",
          description: "Normal mode",
        };
    }
  };

  const getPresetConfig = (preset: ModelPreset) => {
    switch (preset) {
      case "fast-cheap":
        return {
          label: "Fast & Cheap",
          icon: Rocket,
          description: "Fastest models, lowest cost",
        };
      case "balanced":
        return {
          label: "Balanced",
          icon: Scale,
          description: "Good balance of speed and quality",
        };
      case "high-quality":
        return {
          label: "High Quality",
          icon: Sparkles,
          description: "Best quality, higher cost",
        };
      case "custom":
        return {
          label: "Custom",
          icon: Gauge,
          description: "Manual model selection",
        };
    }
  };

  const currentDemoConfig = getDemoModeConfig(demoMode);
  const DemoIcon = currentDemoConfig.icon;

  return (
    <DropdownMenu
      modal={false}
      open={dropdownOpen}
      onOpenChange={setDropdownOpen}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 ${demoMode !== "off" ? currentDemoConfig.color : ""} border`}
        >
          <DemoIcon className="w-4 h-4" />
          <span className="hidden sm:inline">{currentDemoConfig.label}</span>
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
            DEV
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-96 border-border/50 max-h-[80vh] overflow-y-auto z-[150]"
      >
        {/* Demo Mode Section */}
        <div className="text-center py-2">
          <DropdownMenuLabel className="text-base">
            Developer Tools
          </DropdownMenuLabel>
          <p className="text-xs text-muted-foreground px-2">
            Demo mode and model configuration
          </p>
        </div>
        <DropdownMenuSeparator />

        <div className="px-2 py-2">
          <p className="text-xs font-medium text-muted-foreground mb-2 px-2">
            Demo Mode
          </p>
          <DropdownMenuRadioGroup
            value={demoMode}
            onValueChange={(v) => handleDemoModeChange(v as DemoMode)}
          >
            <DropdownMenuRadioItem value="off" className="cursor-pointer">
              <div className="flex flex-col gap-1 py-1">
                <span className="font-medium text-sm">Off</span>
                <span className="text-xs text-muted-foreground">
                  Normal production behavior
                </span>
              </div>
            </DropdownMenuRadioItem>

            <DropdownMenuRadioItem value="no-cost" className="cursor-pointer">
              <div className="flex flex-col gap-1 py-1">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-sm">
                    No-Cost (Mock Data)
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Instant mock responses • Zero API costs
                </span>
              </div>
            </DropdownMenuRadioItem>

            <DropdownMenuRadioItem value="cheap" className="cursor-pointer">
              <div className="flex flex-col gap-1 py-1">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-yellow-600" />
                  <span className="font-medium text-sm">Cheap Inference</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Fastest/cheapest models • Real API calls
                </span>
              </div>
            </DropdownMenuRadioItem>

            <DropdownMenuRadioItem value="real" className="cursor-pointer">
              <div className="flex flex-col gap-1 py-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-sm">Real (Production)</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Production-quality models • Best results
                </span>
              </div>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </div>

        {modelSelectionEnabled && (
          <>
            <DropdownMenuSeparator />

            {/* Model Preset Section */}
            <div className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs font-medium text-muted-foreground mb-2 px-2">
                Model Preset
              </p>
              <DropdownMenuRadioGroup
                value={modelPreset}
                onValueChange={(v) => {
                  const preset = v as ModelPreset;
                  // For custom, we handle it via onSelect to prevent dropdown closing
                  // For other presets, close the dropdown after selection
                  if (preset !== "custom") {
                    handlePresetChange(preset);
                  } else {
                    // Still update the state, but don't close dropdown
                    setModelPreset(preset);
                  }
                }}
              >
                <DropdownMenuRadioItem
                  value="fast-cheap"
                  className="cursor-pointer"
                >
                  <div className="flex flex-col gap-1 py-1">
                    <div className="flex items-center gap-2">
                      <Rocket className="w-4 h-4" />
                      <span className="font-medium text-sm">Fast & Cheap</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      GPT-OSS-20B • FLUX Schnell • WAN 2.5 Fast
                    </span>
                  </div>
                </DropdownMenuRadioItem>

                <DropdownMenuRadioItem
                  value="balanced"
                  className="cursor-pointer"
                >
                  <div className="flex flex-col gap-1 py-1">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4" />
                      <span className="font-medium text-sm">Balanced</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      GPT-4o-mini • Leonardo Phoenix • WAN 2.5 Fast
                    </span>
                  </div>
                </DropdownMenuRadioItem>

                <DropdownMenuRadioItem
                  value="high-quality"
                  className="cursor-pointer"
                >
                  <div className="flex flex-col gap-1 py-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span className="font-medium text-sm">High Quality</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      GPT-4.1 Mini • FLUX Pro • Veo 3.1
                    </span>
                  </div>
                </DropdownMenuRadioItem>

                <DropdownMenuRadioItem
                  value="custom"
                  className="cursor-pointer"
                  onSelect={(e) => {
                    // Prevent dropdown from closing when custom is selected
                    e.preventDefault();
                    handlePresetChange("custom", false);
                  }}
                >
                  <div className="flex flex-col gap-1 py-1">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-4 h-4" />
                      <span className="font-medium text-sm">Custom</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Manual model selection
                    </span>
                  </div>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </div>

            {/* Individual Model Selectors (only shown when Custom is selected) */}
            {modelPreset === "custom" && (
              <>
                <DropdownMenuSeparator />
                <div
                  className="px-4 py-3 space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Individual Models
                  </p>

                  {/* Questions Model */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Questions</label>
                    <Select
                      value={textToTextModel}
                      onValueChange={(v) =>
                        handleIndividualModelChange("text", v)
                      }
                    >
                      <SelectTrigger
                        className="w-full h-8 text-xs cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        className="!z-[9999]"
                        position="popper"
                        sideOffset={5}
                        side="bottom"
                        align="start"
                        avoidCollisions={true}
                      >
                        {TEXT_TO_TEXT_MODELS.map((model) => (
                          <SelectItem
                            key={model.id}
                            value={model.id}
                            className="text-xs"
                          >
                            <div className="flex items-center justify-between w-full gap-2">
                              <span className="truncate">{model.name}</span>
                              <div className="flex gap-1 flex-shrink-0">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 h-4"
                                >
                                  {SPEED_INDICATORS[model.speed]}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 h-4"
                                >
                                  {COST_INDICATORS[model.cost]}
                                </Badge>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Storyboard Model */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Storyboard</label>
                    <Select
                      value={textToImageModel}
                      onValueChange={(v) =>
                        handleIndividualModelChange("image", v)
                      }
                    >
                      <SelectTrigger
                        className="w-full h-8 text-xs cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        className="!z-[9999]"
                        position="popper"
                        sideOffset={5}
                        side="bottom"
                        align="start"
                        avoidCollisions={true}
                      >
                        {TEXT_TO_IMAGE_MODELS.filter(
                          (model) =>
                            ![
                              "flux-pro-ultra",
                              "consistent-character",
                              "sdxl-lightning",
                              "sdxl",
                              "sd3-medium",
                              "sd3-turbo",
                              "hidream-i1",
                            ].includes(model.id),
                        ).map((model) => (
                          <SelectItem
                            key={model.id}
                            value={model.id}
                            className="text-xs"
                          >
                            <div className="flex items-center justify-between w-full gap-2">
                              <span className="truncate">{model.name}</span>
                              <div className="flex gap-1 flex-shrink-0">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 h-4"
                                >
                                  {SPEED_INDICATORS[model.speed]}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 h-4"
                                >
                                  {COST_INDICATORS[model.cost]}
                                </Badge>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Video Model */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Video</label>
                    <Select
                      value={imageToVideoModel}
                      onValueChange={(v) =>
                        handleIndividualModelChange("video", v)
                      }
                    >
                      <SelectTrigger
                        className="w-full h-8 text-xs cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent
                        className="!z-[9999]"
                        position="popper"
                        sideOffset={5}
                        side="bottom"
                        align="start"
                        avoidCollisions={true}
                      >
                        {IMAGE_TO_VIDEO_MODELS.map((model) => (
                          <SelectItem
                            key={model.id}
                            value={model.id}
                            className="text-xs"
                          >
                            <div className="flex items-center justify-between w-full gap-2">
                              <span className="truncate">{model.name}</span>
                              <div className="flex gap-1 flex-shrink-0">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 h-4"
                                >
                                  {SPEED_INDICATORS[model.speed]}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 h-4"
                                >
                                  {COST_INDICATORS[model.cost]}
                                </Badge>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {demoMode !== "off" && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-2 text-xs text-muted-foreground text-center">
              <p className="font-medium mb-1">
                Active: {currentDemoConfig.label}
              </p>
              <p>{currentDemoConfig.description}</p>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
