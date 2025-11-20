"use client";

import { useEffect, useMemo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectScene, SceneShot, ShotPreviewImage } from "@/lib/types/redesign";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { ShotImageGrid } from "./ShotImageGrid";

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
}: ShotCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(shot.description);

  useEffect(() => {
    if (!isEditing) {
      setDraft(shot.description);
    }
  }, [shot.description, isEditing]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: shot._id,
    data: { type: "shot", sceneId: scene._id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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

  const commitDraft = () => {
    if (draft.trim().length && draft !== shot.description) {
      onUpdateShotText(shot._id, draft.trim());
    }
    setIsEditing(false);
  };

  return (
    <Card
      ref={setRefs}
      style={style}
      onClick={() => !isEditing && onShotClick(shot)}
      className={cn(
        "p-3 bg-[#131414] border border-gray-800/60 hover:border-gray-600/80 transition-all",
        isDragging && "opacity-50",
        isActive && "ring-2 ring-emerald-400/70",
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
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className={cn(
                "text-xs flex items-center gap-1 border",
                shot.selectedImageId
                  ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
                  : "bg-[#111] text-gray-300 border-gray-700",
              )}
            >
              {shot.selectedImageId && <CheckCircle2 className="w-3 h-3" />}
              {label}
            </Badge>
          </div>

          {isEditing ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsEditing(false);
                  setDraft(shot.description);
                }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  commitDraft();
                }
              }}
              autoFocus
              className="w-full bg-[#0a0a0a] text-sm text-gray-100 min-h-[70px]"
            />
          ) : (
            <p
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="text-sm text-gray-200 cursor-text hover:bg-[#0f0f0f] px-2 py-1 rounded transition-colors"
            >
              {shot.description}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
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
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onRegenerateShot?.(shot);
            }}
            className="h-8 w-8 text-gray-400 hover:text-gray-100"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onEnterIterator(shot);
            }}
            className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40"
          >
            <ArrowUpRight className="w-4 h-4" />
          </Button>
        </div>
       </div>
      <ShotImageGrid
        images={previewImages}
        isLoading={shot.lastImageStatus === "processing" || shot.lastImageStatus === "pending"}
        selectedImageId={shot.selectedImageId}
        onSelect={(image) => onSelectImage?.(shot, image)}
        onIterate={() => onEnterIterator(shot)}
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
}: PromptPlannerCardProps) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);

  const {
    attributes: sceneAttributes,
    listeners: sceneListeners,
    setNodeRef: setSceneRef,
    transform: sceneTransform,
    transition: sceneTransition,
    isDragging: isSceneDragging,
  } = useSortable({
    id: scene._id,
    data: { type: "scene" },
  });

  const sceneStyle = {
    transform: CSS.Transform.toString(sceneTransform),
    transition: sceneTransition,
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
        "p-4 bg-[#171717] border border-gray-800 hover:border-gray-600/70 transition-opacity",
        isSceneDragging && "opacity-50",
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
          {editingTitle ? (
            <input
              value={scene.title}
              onChange={(e) => onUpdateSceneTitle(scene._id, e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setEditingTitle(false);
              }}
              autoFocus
              className="w-full bg-[#111] text-xl font-semibold text-white px-2 py-1 rounded border border-gray-700"
            />
          ) : (
            <div
              onClick={() => setEditingTitle(true)}
              className="text-xl font-semibold text-white cursor-text hover:bg-[#111] px-2 py-1 rounded"
            >
              {scene.title}
            </div>
          )}

          {editingDescription ? (
            <Textarea
              value={scene.description}
              onChange={(e) =>
                onUpdateSceneDescription(scene._id, e.target.value)
              }
              onBlur={() => setEditingDescription(false)}
              autoFocus
              className="w-full bg-[#111] text-sm text-gray-200 min-h-[70px]"
            />
          ) : (
            <p
              onClick={() => setEditingDescription(true)}
              className="text-sm text-gray-300 cursor-text hover:bg-[#111] px-2 py-1 rounded"
            >
              {scene.description}
            </p>
          )}

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
