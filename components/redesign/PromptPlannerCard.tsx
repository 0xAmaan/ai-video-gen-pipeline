"use client";

import { useState } from "react";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface Shot {
  id: string;
  text: string;
  color?: "green" | "red" | "blue" | "amber";
}

export interface Scene {
  id: string;
  title: string;
  description: string;
  shots: Shot[];
  isExpanded?: boolean;
}

interface PromptPlannerCardProps {
  scene: Scene;
  sceneIndex: number;
  onToggleExpand: (sceneId: string) => void;
  onShotClick: (shot: Shot, sceneId: string) => void;
  onAddShot: (sceneId: string) => void;
  onDeleteScene: (sceneId: string) => void;
  onDeleteShot: (sceneId: string, shotId: string) => void;
  onUpdateSceneTitle: (sceneId: string, title: string) => void;
  onUpdateSceneDescription: (sceneId: string, description: string) => void;
  onUpdateShotText: (sceneId: string, shotId: string, text: string) => void;
}

interface ShotCardProps {
  shot: Shot;
  sceneId: string;
  sceneIndex: number;
  shotIndex: number;
  editingShotId: string | null;
  onShotClick: (shot: Shot, sceneId: string) => void;
  onDeleteShot: (sceneId: string, shotId: string) => void;
  onUpdateShotText: (sceneId: string, shotId: string, text: string) => void;
  setEditingShotId: (shotId: string | null) => void;
}

const SHOT_COLOR_CLASSES = {
  green: "border-l-green-600",
  red: "border-l-red-600",
  blue: "border-l-blue-600",
  amber: "border-l-amber-600",
};

const ShotCard: React.FC<ShotCardProps> = ({
  shot,
  sceneId,
  sceneIndex,
  shotIndex,
  editingShotId,
  onShotClick,
  onDeleteShot,
  onUpdateShotText,
  setEditingShotId,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: shot.id,
    data: { sceneId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      onClick={() => !editingShotId && onShotClick(shot, sceneId)}
      className={`p-3 bg-[#131414] border-gray-800/50 border-l-4 hover:border-gray-500/50 transition-all cursor-pointer ${
        shot.color ? SHOT_COLOR_CLASSES[shot.color] : "border-l-gray-600"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-2">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
        </div>

        <div className="flex-1 min-w-0">
          <Badge variant="secondary" className="text-xs mb-2">
            Shot {sceneIndex + 1}.{shotIndex + 1}
          </Badge>

          {editingShotId === shot.id ? (
            <Textarea
              value={shot.text}
              onChange={(e) => onUpdateShotText(sceneId, shot.id, e.target.value)}
              onBlur={() => setEditingShotId(null)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="w-full bg-[#0a0a0a] text-sm text-gray-200 min-h-[60px]"
            />
          ) : (
            <p
              onClick={(e) => {
                e.stopPropagation();
                setEditingShotId(shot.id);
              }}
              className="text-sm text-gray-200 cursor-text hover:bg-[#0a0a0a] px-2 py-1 rounded transition-colors"
            >
              {shot.text}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteShot(sceneId, shot.id);
          }}
          className="flex-shrink-0 h-6 w-6 text-gray-500 hover:text-red-400 cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </Card>
  );
};

export const PromptPlannerCard: React.FC<PromptPlannerCardProps> = ({
  scene,
  sceneIndex,
  onToggleExpand,
  onShotClick,
  onAddShot,
  onDeleteScene,
  onDeleteShot,
  onUpdateSceneTitle,
  onUpdateSceneDescription,
  onUpdateShotText,
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingShotId, setEditingShotId] = useState<string | null>(null);

  // Use dnd-kit sortable for scene
  const {
    attributes: sceneAttributes,
    listeners: sceneListeners,
    setNodeRef: setSceneRef,
    transform: sceneTransform,
    transition: sceneTransition,
    isDragging: isSceneDragging,
  } = useSortable({ id: scene.id });

  const sceneStyle = {
    transform: CSS.Transform.toString(sceneTransform),
    transition: sceneTransition,
  };

  return (
    <Card
      ref={setSceneRef}
      style={sceneStyle}
      className={`p-4 transition-opacity bg-[#171717] border-gray-800 hover:border-gray-500/50 ${
        isSceneDragging ? "opacity-50" : ""
      }`}
    >
      {/* Scene Header */}
      <div className="flex items-start gap-3 mb-3">
        <div {...sceneAttributes} {...sceneListeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="w-5 h-5 text-gray-500 flex-shrink-0 mt-1" />
        </div>

        <button
          onClick={() => onToggleExpand(scene.id)}
          className="flex-shrink-0 mt-1 text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
        >
          {scene.isExpanded ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Title */}
          {editingTitle ? (
            <input
              type="text"
              value={scene.title}
              onChange={(e) => onUpdateSceneTitle(scene.id, e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setEditingTitle(false);
              }}
              autoFocus
              className="w-full bg-[#131414] text-lg font-semibold text-white px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-gray-500"
            />
          ) : (
            <div
              onClick={() => setEditingTitle(true)}
              className="text-lg font-semibold text-white cursor-text hover:bg-[#131414] px-2 py-1 rounded transition-colors"
            >
              {scene.title}
            </div>
          )}

          {/* Description */}
          {editingDescription ? (
            <Textarea
              value={scene.description}
              onChange={(e) => onUpdateSceneDescription(scene.id, e.target.value)}
              onBlur={() => setEditingDescription(false)}
              autoFocus
              className="w-full bg-[#131414] text-sm text-gray-300 mt-1 min-h-[60px]"
            />
          ) : (
            <div
              onClick={() => setEditingDescription(true)}
              className="text-sm text-gray-300 mt-1 cursor-text hover:bg-[#131414] px-2 py-1 rounded transition-colors"
            >
              {scene.description}
            </div>
          )}

          {/* Collapsed State - Show Shot Count */}
          {!scene.isExpanded && scene.shots.length > 0 && (
            <Badge variant="outline" className="mt-2 text-xs text-gray-400">
              {scene.shots.length} {scene.shots.length === 1 ? "shot" : "shots"}
            </Badge>
          )}
        </div>

        {/* Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 h-8 w-8 text-gray-400 hover:text-gray-200"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#171717] border-gray-800">
            <DropdownMenuItem
              onClick={() => onDeleteScene(scene.id)}
              className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Scene
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Expanded State - Show Shots */}
      {scene.isExpanded && (
        <div className="ml-8 space-y-2 mt-4">
          {scene.shots.map((shot, shotIndex) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              sceneId={scene.id}
              sceneIndex={sceneIndex}
              shotIndex={shotIndex}
              editingShotId={editingShotId}
              onShotClick={onShotClick}
              onDeleteShot={onDeleteShot}
              onUpdateShotText={onUpdateShotText}
              setEditingShotId={setEditingShotId}
            />
          ))}

          {/* Add Shot Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddShot(scene.id)}
            className="w-full border-dashed border-gray-700 hover:border-gray-500 text-gray-400 hover:text-gray-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Shot
          </Button>
        </div>
      )}
    </Card>
  );
};
