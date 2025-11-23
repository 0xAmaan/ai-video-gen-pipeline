"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  Link2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  onResetShot?: (shot: SceneShot) => void;
  onGeneratePreview?: (shot: SceneShot) => void;
  onUpdateShotAssets?: (shotId: Id<"sceneShots">, assetIds: Id<"projectAssets">[]) => void;
  assets?: ProjectAsset[];
  resettingShotIds?: Id<"sceneShots">[];
  onOpenLinkModal?: (shot: SceneShot, scene: ProjectScene) => void;
  getLinkedShotLabel?: (linkedShotId: Id<"sceneShots">) => string | null;
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
  onResetShot?: (shot: SceneShot) => void;
  onGeneratePreview?: (shot: SceneShot) => void;
  onUpdateAssets?: (shotId: Id<"sceneShots">, assetIds: Id<"projectAssets">[]) => void;
  assets?: ProjectAsset[];
  isResetting?: boolean;
  onOpenLinkModal?: (shot: SceneShot, scene: ProjectScene) => void;
  getLinkedShotLabel?: (linkedShotId: Id<"sceneShots">) => string | null;
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
  onResetShot,
  onGeneratePreview,
  onUpdateAssets,
  assets,
  isResetting = false,
  onOpenLinkModal,
  getLinkedShotLabel,
}: ShotCardProps) => {
  const [localDescription, setLocalDescription] = useState(shot.description);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [previewCleared, setPreviewCleared] = useState(false);

  // Sync local state with prop changes
  useEffect(() => {
    setLocalDescription(shot.description);
    setDeleteConfirm(false);
    setResetConfirm(false);
    setPreviewCleared(false);
  }, [shot.description, shot._id]);

  useEffect(() => {
    if (deleteConfirm) {
      const timer = setTimeout(() => setDeleteConfirm(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [deleteConfirm]);

  useEffect(() => {
    if (resetConfirm) {
      const timer = setTimeout(() => setResetConfirm(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [resetConfirm]);

  useEffect(() => {
    if ((previewImages?.length ?? 0) > 0 && !isResetting) {
      setPreviewCleared(false);
    }
  }, [previewImages?.length, isResetting]);

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

  const handleDeleteClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setResetConfirm(false);
      return;
    }
    setDeleteConfirm(false);
    onDeleteShot(shot._id);
  };

  const handleResetClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (isResetting) return;

    if (!resetConfirm) {
      setResetConfirm(true);
      setDeleteConfirm(false);
      return;
    }

    setPreviewCleared(true);
    setResetConfirm(false);
    onResetShot?.(shot);
  };

  const triggerGenerate = () => {
    setPreviewCleared(false);
    onGeneratePreview?.(shot);
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
            <div className="flex items-center gap-2 pt-0.5">
              <Button
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenLinkModal?.(shot, scene);
                }}
                className={cn(
                  "h-8 px-3 border-blue-500/40 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20 hover:text-white",
                  shot.linkedShotId &&
                    "border-emerald-400/50 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20",
                )}
              >
                <Link2 className="w-4 h-4 mr-1.5" />
                {shot.linkedShotId && getLinkedShotLabel
                  ? `Linked ${getLinkedShotLabel(shot.linkedShotId)}`
                  : shot.linkedShotId
                    ? "Linked"
                    : "Link shot"}
              </Button>
              <div onClick={(event) => event.stopPropagation()}>
                <ShotBrandAssetPicker
                  label={label}
                  assets={assets}
                  selectedAssetIds={shot.referencedAssets}
                  onChange={(nextAssets) => onUpdateAssets?.(shot._id, nextAssets)}
                />
              </div>
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

        <TooltipProvider delayDuration={120}>
          <div className="flex flex-row gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDeleteClick}
                  className={cn(
                    "h-8 w-8 text-gray-500 hover:text-red-400",
                    deleteConfirm &&
                      "bg-red-500/10 text-red-200 border border-red-500/30",
                  )}
                >
                  <Trash2
                    className={cn(
                      "w-4 h-4",
                      deleteConfirm && "drop-shadow-[0_0_12px_rgba(248,113,113,0.5)]",
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#0f1115] border border-white/10 text-gray-100 shadow-lg shadow-black/30">
                {deleteConfirm ? "Click again to delete" : "Delete shot"}
              </TooltipContent>
            </Tooltip>

            {previewImages && previewImages.length > 0 && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isResetting}
                      onClick={handleResetClick}
                      className={cn(
                        "h-8 w-8 text-gray-400 hover:text-gray-100",
                        resetConfirm &&
                          "bg-amber-500/10 text-amber-100 border border-amber-400/40",
                        isResetting && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      <RefreshCw
                        className={cn(
                          "w-4 h-4",
                          resetConfirm && "text-amber-200 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]",
                          isResetting && "animate-spin",
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="bg-[#0f1115] border border-white/10 text-gray-100 shadow-lg shadow-black/30">
                    {resetConfirm ? "Click again to reset" : "Reset image & edit prompt"}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
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
                  </TooltipTrigger>
                  <TooltipContent className="bg-[#0f1115] border border-white/10 text-gray-100 shadow-lg shadow-black/30">
                    Adjust image
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </TooltipProvider>
      </div>
      {previewCleared && (
        <div className="mt-3 max-w-xs mx-auto rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Preview cleared.
        </div>
      )}
      
      <ShotImageGrid
        images={previewCleared ? [] : previewImages}
        isLoading={
          isResetting ||
          shot.lastImageStatus === "processing" ||
          shot.lastImageStatus === "pending"
        }
        selectedImageId={shot.selectedImageId}
        onSelect={(image) => onSelectImage?.(shot, image)}
        onIterate={triggerGenerate}
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
  onResetShot,
  onGeneratePreview,
  onUpdateShotAssets,
  assets,
  resettingShotIds,
  onOpenLinkModal,
  getLinkedShotLabel,
}: PromptPlannerCardProps) => {
  const [titleDraft, setTitleDraft] = useState(scene.title);
  const [descriptionDraft, setDescriptionDraft] = useState(
    scene.description ?? "",
  );

  useEffect(() => {
    setTitleDraft(scene.title);
    setDescriptionDraft(scene.description ?? "");
  }, [scene.title, scene.description, scene._id]);

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

  const commitSceneTitle = () => {
    const nextTitle = titleDraft.trim() || `Scene ${scene.sceneNumber}`;
    setTitleDraft(nextTitle);
    if (nextTitle !== scene.title) {
      onUpdateSceneTitle(scene._id, nextTitle);
    }
  };

  const commitSceneDescription = () => {
    const nextDescription = descriptionDraft.trim();
    setDescriptionDraft(nextDescription);
    if (nextDescription !== (scene.description ?? "")) {
      onUpdateSceneDescription(scene._id, nextDescription);
    }
  };

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
          <Input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitSceneTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitSceneTitle();
              }
            }}
            className="text-xl font-semibold text-white bg-[#0f1013] border-gray-700 focus-visible:ring-1 focus-visible:ring-blue-400"
          />

          <Textarea
            value={descriptionDraft}
            onChange={(e) => setDescriptionDraft(e.target.value)}
            onBlur={commitSceneDescription}
            placeholder="Describe your scene..."
            className="text-sm text-gray-200 bg-[#0f1013] border-gray-700 placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-blue-400 resize-none min-h-[56px]"
          />

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
              onResetShot={onResetShot}
              onGeneratePreview={onGeneratePreview}
              onUpdateAssets={onUpdateShotAssets}
              assets={assets}
              isResetting={resettingShotIds?.includes(shot._id)}
              onOpenLinkModal={onOpenLinkModal}
              getLinkedShotLabel={getLinkedShotLabel}
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
