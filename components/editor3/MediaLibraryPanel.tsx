"use client";

import { Cloud, Music, Volume2 } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface MediaLibraryPanelProps {
  projectId: string;
  onClipSelect?: (clipId: string) => void;
  selectedClipId?: string | null;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const MediaLibraryPanel = ({
  projectId,
  onClipSelect,
  selectedClipId
}: MediaLibraryPanelProps) => {
  // Fetch project data from Convex
  const data = useQuery(
    api.video.getProjectWithAllData,
    projectId ? { projectId: projectId as Id<"videoProjects"> } : "skip"
  );

  const project = data?.project ?? null;
  const clips = data?.clips ?? [];
  const audioAssets = data?.audioAssets ?? [];
  const isLoading = data === undefined;

  // Truncate project title
  const projectTitle = project?.title ?? "Untitled Project";
  const truncatedTitle = projectTitle.length > 25
    ? `${projectTitle.slice(0, 25)}...`
    : projectTitle;

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-sm text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Project Title */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <h1 className="text-sm font-semibold text-white truncate" title={projectTitle}>
          {truncatedTitle}
        </h1>
      </div>

      {/* Upload Button */}
      <div className="px-4 pt-4 pb-3">
        <button className="w-full bg-zinc-800 hover:bg-zinc-700 text-cyan-400 font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors border border-zinc-700">
          <Cloud className="w-5 h-5" />
          <span>Upload</span>
        </button>
      </div>

      {/* Media Section */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Section Header */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
            Media
          </h2>
          <span className="text-xs text-zinc-500">({clips.length})</span>
        </div>

        {/* Empty State */}
        {clips.length === 0 && (
          <div className="text-center py-12">
            <Cloud className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No media yet</p>
            <p className="text-xs text-zinc-600 mt-1">Upload videos to get started</p>
          </div>
        )}

        {/* Video Grid - 2 columns */}
        <div className="grid grid-cols-2 gap-3">
          {clips.map((clip, index) => {
            const duration = clip.duration ?? 0;
            const videoUrl = clip.lipsyncVideoUrl ?? clip.videoUrl ?? clip.originalVideoUrl ?? "";

            // Generate filename from clip data
            const fileName = clip.sceneId
              ? `Scene ${index + 1}.mp4`
              : `Clip ${index + 1}.mp4`;

            const isSelected = selectedClipId === clip._id;

            return (
              <div
                key={clip._id}
                draggable={true}
                onDragStart={(e) => {
                  // Set the media ID in the dataTransfer so timeline can access it
                  e.dataTransfer.setData('mediaId', clip._id);
                  e.dataTransfer.effectAllowed = 'copy';

                  // Set drag image (optional: makes the drag look nicer)
                  const target = e.currentTarget as HTMLElement;
                  e.dataTransfer.setDragImage(target, 50, 50);
                }}
                onClick={() => onClipSelect?.(clip._id)}
                className={`group cursor-grab active:cursor-grabbing bg-zinc-800/50 hover:bg-zinc-800 rounded-lg overflow-hidden transition-colors border ${
                  isSelected
                    ? 'border-cyan-500 ring-2 ring-cyan-500/50'
                    : 'border-zinc-700/50 hover:border-zinc-600'
                }`}
              >
                {/* Thumbnail with Duration Overlay */}
                <div className="relative aspect-video bg-zinc-900">
                  {videoUrl ? (
                    <video
                      src={videoUrl}
                      className="w-full h-full object-cover"
                      preload="metadata"
                      muted
                      playsInline
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Cloud className="w-8 h-8 text-zinc-700" />
                    </div>
                  )}

                  {/* Duration Badge */}
                  {duration > 0 && (
                    <div className="absolute bottom-1.5 left-1.5 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs font-medium text-white">
                      {formatDuration(duration)}
                    </div>
                  )}
                </div>

                {/* Filename */}
                <div className="px-2 py-2">
                  <p className="text-xs text-zinc-400 truncate" title={fileName}>
                    {fileName}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Audio Section */}
        {audioAssets.length > 0 && (
          <div className="mt-6">
            {/* Section Header */}
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                Audio
              </h2>
              <span className="text-xs text-zinc-500">({audioAssets.length})</span>
            </div>

            {/* Audio Grid - 1 column for better readability */}
            <div className="space-y-2">
              {audioAssets.map((audio) => {
                const duration = audio.duration ?? 0;
                const audioType = audio.type ?? "audio";

                // Type-specific icons and labels
                const getAudioTypeInfo = (type: string) => {
                  switch (type) {
                    case "bgm":
                      return { icon: Music, label: "BGM", color: "text-blue-400" };
                    case "sfx":
                      return { icon: Volume2, label: "SFX", color: "text-purple-400" };
                    case "narration":
                      return { icon: Volume2, label: "Narration", color: "text-green-400" };
                    case "voiceover":
                      return { icon: Volume2, label: "Voiceover", color: "text-cyan-400" };
                    default:
                      return { icon: Music, label: "Audio", color: "text-zinc-400" };
                  }
                };

                const typeInfo = getAudioTypeInfo(audioType);
                const TypeIcon = typeInfo.icon;

                return (
                  <div
                    key={audio._id}
                    draggable={true}
                    onDragStart={(e) => {
                      // Set the media ID for timeline drag-and-drop
                      e.dataTransfer.setData('mediaId', audio._id);
                      e.dataTransfer.setData('mediaType', 'audio');
                      e.dataTransfer.effectAllowed = 'copy';

                      const target = e.currentTarget as HTMLElement;
                      e.dataTransfer.setDragImage(target, 50, 25);
                    }}
                    className="group cursor-grab active:cursor-grabbing bg-zinc-800/50 hover:bg-zinc-800 rounded-lg overflow-hidden transition-colors border border-zinc-700/50 hover:border-zinc-600"
                  >
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      {/* Icon */}
                      <div className={`flex-shrink-0 ${typeInfo.color}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${typeInfo.color} bg-zinc-900/50`}>
                            {typeInfo.label}
                          </span>
                          {duration > 0 && (
                            <span className="text-xs text-zinc-500">
                              {formatDuration(duration)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 truncate">
                          {audio.name || `${typeInfo.label} Track`}
                        </p>
                      </div>

                      {/* Drag Indicator */}
                      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex flex-col gap-0.5">
                          <div className="w-3 h-0.5 bg-zinc-600 rounded"></div>
                          <div className="w-3 h-0.5 bg-zinc-600 rounded"></div>
                          <div className="w-3 h-0.5 bg-zinc-600 rounded"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
