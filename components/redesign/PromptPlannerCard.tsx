"use client";

import { useEffect, useMemo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
  MoreVertical,
  ArrowUpRight,
  CheckCircle2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectAsset, ProjectScene, SceneShot, ShotPreviewImage } from "@/lib/types/redesign";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { ShotImageGrid } from "./ShotImageGrid";
import { ShotBrandAssetPicker } from "./ShotBrandAssetPicker";

interface PromptPlannerCardProps {
  scene: ProjectScene;
  sceneIndex: number;
  shots: SceneShot[];
  isExpanded: boolean;
  activeShotId?: Id<"sceneShots"> | null;
  onToggleExpand: (sceneId: Id<"projectScenes">) => void;
  onShotClick: (shot: SceneShot) => void;
  onAddShot: (sceneId: Id<"projectScenes">) => void;
  onAddSceneBelow: (sceneId: Id<"projectScenes">) => void;
  onDeleteScene: (sceneId: Id<"projectScenes">) => void;
  onDeleteShot: (shotId: Id<"sceneShots">) => void;
  onUpdateSceneTitle: (sceneId: Id<"projectScenes">, title: string) => void;
  onUpdateSceneDescription: (
    sceneId: Id<"projectScenes">,
    description: string,
  ) => void;
  onUpdateShotText: (shotId: Id<"sceneShots">, text: string) => void;
  onEnterIterator: (shot: SceneShot) => void;
  registerShotRef?: (shotId: Id<"sceneShots">, node: HTMLDivElement | null) => void;
  getShotPreviewImages?: (shotId: Id<"sceneShots">) => ShotPreviewImage[] | undefined;
  onSelectShotImage?: (shot: SceneShot, image: ShotPreviewImage) => void;
  onRegenerateShot?: (shot: SceneShot) => void;
  onGeneratePreview?: (shot: SceneShot) => void;
  onUpdateShotAssets?: (shotId: Id<"sceneShots">, assetIds: Id<"projectAssets">[]) => void;
  assets?: ProjectAsset[];
  resettingShotId?: Id<"sceneShots"> | null;
}

interface ShotCardProps {
  shot: SceneShot;
  scene: ProjectScene;
  sceneIndex: number;
  shotIndex: number;
  isActive: boolean;
  onShotClick: (shot: SceneShot) => void;
  onDeleteShot: (shotId: Id<"sceneShots">) => void;
  onUpdateShotText: (shotId: Id<"sceneShots">, text: string) => void;
  onEnterIterator: (shot: SceneShot) => void;
  registerShotRef?: (shotId: Id<"sceneShots">, node: HTMLDivElement | null) => void;
  previewImages?: ShotPreviewImage[];
  onSelectImage?: (shot: SceneShot, image: ShotPreviewImage) => void;
  onRegenerateShot?: (shot: SceneShot) => void;
  onGeneratePreview?: (shot: SceneShot) => void;
  onUpdateAssets?: (shotId: Id<"sceneShots">, assetIds: Id<"projectAssets">[]) => void;
  assets?: ProjectAsset[];
  isResetting?: boolean;
}

const ShotCard = ({
  shot,
  scene,
  sceneIndex,
  shotIndex,
  isActive,
  onShotClick,
  onDeleteShot,
  onUpdateShotText,
  onEnterIterator,
  registerShotRef,
  previewImages,
  onSelectImage,
  onRegenerateShot,
  onGeneratePreview,
  onUpdateAssets,
  assets,
  isResetting = false,
}: ShotCardProps) => {
  const [localDescription, setLocalDescription] = useState(shot.description);

  // Sync local state with prop changes
  useEffect(() => {
    setLocalDescription(shot.description);
  }, [shot.description]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: shot._id,
    data: { type: "shot", sceneId: scene._id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)",
  };

  const setRefs = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    registerShotRef?.(shot._id, node);
  };

  const label = useMemo(() => {
    const shotNumber =
      shot.shotNumber !== undefined
        ? shot.shotNumber
        : shotIndex + 1;
    return `Shot ${scene.sceneNumber}.${shotNumber}`;
  }, [scene.sceneNumber, shot.shotNumber, shotIndex]);

  const hasImage = !!shot.selectedImageId;

  const handleDescriptionChange = (value: string) => {
    setLocalDescription(value);
    onUpdateShotText(shot._id, value);
  };

  return (
    <Card
      ref={setRefs}
      style={style}
      onClick={() => onShotClick(shot)}
      className={cn(
        "p-3 bg-[#131414] border transition-all relative cursor-pointer",
        isDragging && "opacity-30 scale-95",
        isOver && "border-blue-400 border-dashed border-2 bg-blue-500/10 shadow-lg shadow-blue-500/20",
        !isDragging && !isOver && "border-gray-800/60 hover:border-gray-600/80",
        isActive && "ring-2 ring-blue-400/70",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing text-gray-500 mt-1"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start gap-2 justify-between">
            <Badge
              variant="secondary"
              className={cn(
                "text-xs flex items-center gap-1 border",
                shot.selectedImageId
                  ? "bg-blue-500/15 text-blue-200 border-blue-500/30"
                  : "bg-[#111] text-gray-300 border-gray-700",
              )}
            >
              {shot.selectedImageId && <CheckCircle2 className="w-3 h-3" />}
              {label}
            </Badge>
            <div
              onClick={(event) => event.stopPropagation()}
              className="pt-0.5"
            >
              <ShotBrandAssetPicker
                label={label}
                assets={assets}
                selectedAssetIds={shot.referencedAssets}
                onChange={(nextAssets) => onUpdateAssets?.(shot._id, nextAssets)}
              />
            </div>
          </div>

          {hasImage ? (
            <p className="text-sm text-gray-400 px-2 py-1">
              {shot.description}
            </p>
          ) : (
            <Textarea
              value={localDescription}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Describe your shot here..."
              className="text-sm bg-[#0a0a0a] border-gray-700 text-gray-200 placeholder:text-gray-500 min-h-[60px] resize-none"
            />
          )}
        </div>

        <div className="flex flex-row gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteShot(shot._id);
            }}
            className="h-8 w-8 text-gray-500 hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          {previewImages && previewImages.length > 0 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerateShot?.(shot);
                }}
                disabled={isResetting}
                className="h-8 w-8 text-gray-400 hover:text-gray-100 disabled:text-gray-600"
                aria-label="Clear shot"
                title="Clear shot"
              >
                {isResetting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
              <Button
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onEnterIterator(shot);
                }}
                className="h-8 w-8 rounded-full bg-blue-500/20 text-blue-300 hover:bg-blue-500/40"
              >
                <ArrowUpRight className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
       </div>
      <ShotImageGrid
        images={previewImages}
        isLoading={shot.lastImageStatus === "processing" || shot.lastImageStatus === "pending"}
        selectedImageId={shot.selectedImageId}
        onSelect={(image) => onSelectImage?.(shot, image)}
        onIterate={() => onGeneratePreview?.(shot)}
        footer={
          shot.lastImageStatus === "failed" ? (
            <p className="text-xs text-red-400">
              Generation failed. Try regenerating with new guidance.
            </p>
          ) : null
        }
      />
    </Card>
  );
};

export const PromptPlannerCard = ({
  scene,
  sceneIndex,
  shots,
  isExpanded,
  activeShotId,
  onToggleExpand,
  onShotClick,
  onAddShot,
  onAddSceneBelow,
  onDeleteScene,
  onDeleteShot,
  onUpdateSceneTitle,
  onUpdateSceneDescription,
  onUpdateShotText,
  onEnterIterator,
  registerShotRef,
  getShotPreviewImages,
  onSelectShotImage,
  onRegenerateShot,
  onGeneratePreview,
  onUpdateShotAssets,
  assets,
  resettingShotId,
}: PromptPlannerCardProps) => {
  const {
    attributes: sceneAttributes,
    listeners: sceneListeners,
    setNodeRef: setSceneRef,
    transform: sceneTransform,
    transition: sceneTransition,
    isDragging: isSceneDragging,
    isOver: isSceneOver,
  } = useSortable({
    id: scene._id,
    data: { type: "scene" },
  });

  const sceneStyle = {
    transform: CSS.Transform.toString(sceneTransform),
    transition: sceneTransition || "transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)",
  };

  const sortedShots = useMemo(
    () =>
      [...shots].sort((a, b) => (a.shotNumber ?? 0) - (b.shotNumber ?? 0)),
    [shots],
  );

  return (
    <Card
      ref={setSceneRef}
      style={sceneStyle}
      className={cn(
        "p-4 bg-[#171717] border transition-all",
        isSceneDragging && "opacity-30 scale-98",
        isSceneOver && "border-blue-400 border-dashed border-2 bg-blue-500/10 shadow-lg shadow-blue-500/20",
        !isSceneDragging && !isSceneOver && "border-gray-800 hover:border-gray-600/70",
      )}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          {...sceneAttributes}
          {...sceneListeners}
          className="cursor-grab active:cursor-grabbing text-gray-500 mt-1"
        >
          <GripVertical className="w-5 h-5" />
        </div>

        <button
          onClick={() => onToggleExpand(scene._id)}
          className="text-gray-400 hover:text-gray-200 mt-1 cursor-pointer"
        >
          {isExpanded ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="text-xl font-semibold text-white px-2 py-1">
            {scene.title}
          </div>

          <p className="text-sm text-gray-300 px-2 py-1">
            {scene.description}
          </p>

          {!isExpanded && (
            <Badge variant="outline" className="text-xs text-gray-400">
              {sortedShots.length}{" "}
              {sortedShots.length === 1 ? "shot" : "shots"}
            </Badge>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-gray-200"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-[#171717] border border-gray-800"
          >
            <DropdownMenuItem
              onClick={() => onDeleteScene(scene._id)}
              className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Scene
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && (
        <div className="space-y-2">
          {sortedShots.map((shot, idx) => (
            <ShotCard
              key={shot._id}
              shot={shot}
              scene={scene}
              sceneIndex={sceneIndex}
              shotIndex={idx}
              isActive={activeShotId === shot._id}
              onShotClick={onShotClick}
              onDeleteShot={onDeleteShot}
              onUpdateShotText={onUpdateShotText}
              onEnterIterator={onEnterIterator}
              registerShotRef={registerShotRef}
              previewImages={getShotPreviewImages?.(shot._id)}
              onSelectImage={onSelectShotImage}
              onRegenerateShot={onRegenerateShot}
              onGeneratePreview={onGeneratePreview}
              onUpdateAssets={onUpdateShotAssets}
              assets={assets}
              isResetting={resettingShotId === shot._id}
            />
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddShot(scene._id)}
            className="w-full border-dashed border-gray-700 hover:border-gray-500 text-gray-300 hover:text-gray-100"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Shot
          </Button>
        </div>
      )}
    </Card>
  );
};
