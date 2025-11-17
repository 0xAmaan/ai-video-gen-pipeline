"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { TEXT_TO_TEXT_MODELS, TEXT_TO_IMAGE_MODELS, IMAGE_TO_VIDEO_MODELS, SPEED_INDICATORS, COST_INDICATORS, TextToImageModel } from "@/lib/types/models";
import { useTextToTextModel, useTextToImageModel, useImageToVideoModel, useModelStore } from "@/lib/stores/modelStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Filtered list of text-to-image models for storyboard generation
// Excludes models that are temporarily disabled for selection
const FILTERED_TEXT_TO_IMAGE_MODELS: TextToImageModel[] = TEXT_TO_IMAGE_MODELS.filter(
  (model) => ![
    "flux-pro-ultra",                    // FLUX.1 Pro Ultra
    "consistent-character",              // Consistent Character (InstantID + IPAdapter)
    "sdxl-lightning",                    // SDXL Lightning
    "sdxl",                              // Stable Diffusion XL
    "sd3-medium",                        // Stable Diffusion 3 Medium
    "sd3-turbo",                         // Stable Diffusion 3 Turbo
    "hidream-i1",                        // HiDream-I1
  ].includes(model.id)
);

interface ModelSelectorProps {
  step: "text-to-text" | "text-to-image" | "image-to-video";
  title?: string;
  description?: string;
  className?: string;
}

export function ModelSelector({ step, title, description, className }: ModelSelectorProps) {
  const useModelSelectionEnabled = useModelStore((state) => state.modelSelectionEnabled);

  if (!useModelSelectionEnabled) {
    return null;
  }

  switch (step) {
    case "text-to-text":
      return <TextToTextModelSelector title={title} description={description} className={className} />;
    case "text-to-image":
      return <TextToImageModelSelector title={title} description={description} className={className} />;
    case "image-to-video":
      return <ImageToVideoModelSelector title={title} description={description} className={className} />;
    default:
      return null;
  }
}

function TextToTextModelSelector({
  title = "Text Generation Model",
  description = "Select the AI model for generating clarifying questions",
  className
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  const selectedModel = useTextToTextModel();
  const setTextToTextModel = useModelStore((state) => state.setTextToTextModel);

  
  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-sm">{description}</CardDescription>
            </div>
            <Tooltip>
              <TooltipTrigger>
                <InfoCircledIcon className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">
                  Choose the AI model that will process your text. Faster models respond quicker but may be less powerful.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent>
          <Select value={selectedModel} onValueChange={setTextToTextModel}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a model..." />
            </SelectTrigger>
            <SelectContent>
              {TEXT_TO_TEXT_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center justify-between w-full min-w-0">
                    <div className="flex flex-col items-start min-w-0 flex-1">
                      <span className="font-medium text-sm truncate">{model.name}</span>
                      {model.description && (
                        <span className="text-xs text-muted-foreground hidden sm:inline truncate">
                          {model.description}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {SPEED_INDICATORS[model.speed]} {model.speed}
                      </Badge>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {COST_INDICATORS[model.cost]} {model.cost}
                      </Badge>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function TextToImageModelSelector({
  title = "Image Generation Model",
  description = "Select the AI model for generating storyboard images",
  className
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  const selectedModel = useTextToImageModel();
  const setTextToImageModel = useModelStore((state) => state.setTextToImageModel);

  
  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-sm">{description}</CardDescription>
            </div>
            <Tooltip>
              <TooltipTrigger>
                <InfoCircledIcon className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">
                  Choose the AI model that will generate your storyboard images. Higher cost models generally produce better quality images.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent>
          <Select value={selectedModel} onValueChange={setTextToImageModel}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a model..." />
            </SelectTrigger>
            <SelectContent>
              {FILTERED_TEXT_TO_IMAGE_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center justify-between w-full min-w-0">
                    <div className="flex flex-col items-start min-w-0 flex-1">
                      <span className="font-medium text-sm truncate">{model.name}</span>
                      {model.description && (
                        <span className="text-xs text-muted-foreground hidden sm:inline truncate">
                          {model.description}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {SPEED_INDICATORS[model.speed]} {model.speed}
                      </Badge>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {COST_INDICATORS[model.cost]} {model.cost}
                      </Badge>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function ImageToVideoModelSelector({
  title = "Video Generation Model",
  description = "Select the AI model for generating video clips",
  className
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  const selectedModel = useImageToVideoModel();
  const setImageToVideoModel = useModelStore((state) => state.setImageToVideoModel);

  
  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-sm">{description}</CardDescription>
            </div>
            <Tooltip>
              <TooltipTrigger>
                <InfoCircledIcon className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">
                  Choose the AI model that will convert your storyboard images into video clips. Different models offer varying levels of motion quality and generation speed.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent>
          <Select value={selectedModel} onValueChange={setImageToVideoModel}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a model..." />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_TO_VIDEO_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center justify-between w-full min-w-0">
                    <div className="flex flex-col items-start min-w-0 flex-1">
                      <span className="font-medium text-sm truncate">{model.name}</span>
                      {model.description && (
                        <span className="text-xs text-muted-foreground hidden sm:inline truncate">
                          {model.description}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {SPEED_INDICATORS[model.speed]} {model.speed}
                      </Badge>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {COST_INDICATORS[model.cost]} {model.cost}
                      </Badge>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          </CardContent>
      </Card>
    </TooltipProvider>
  );
}