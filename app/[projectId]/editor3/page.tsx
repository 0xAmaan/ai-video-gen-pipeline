"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Image, Type, Subtitles, Shuffle, Sparkles, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { TextPanel } from "@/components/editor/TextPanel";
import { CaptionsPanel } from "@/components/editor/CaptionsPanel";
import { TransitionLibrary } from "@/components/editor/TransitionLibrary";
import { FilterLibrary } from "@/components/editor/FilterLibrary";
import { MediaLibraryPanel } from "@/components/editor3/MediaLibraryPanel";
import { VideoPlayer } from "@/components/editor/VideoPlayer";
import { Timeline } from "@/components/timeline";
import { MediaBunnyManager } from "@/lib/editor/io/media-bunny-manager";
import type { Sequence, MediaAssetMeta } from "@/lib/editor/types";

type PanelType = 'media' | 'text' | 'captions' | 'transitions' | 'effects';

export default function Editor3Page() {
  const params = useParams();
  const projectId = params?.projectId as string;

  const [activePanel, setActivePanel] = useState<PanelType>('media');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [videoHeight, setVideoHeight] = useState(50); // Percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Video player state
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mediaBunnyManager, setMediaBunnyManager] = useState<MediaBunnyManager | null>(null);
  const [mediaAssets, setMediaAssets] = useState<Record<string, MediaAssetMeta>>({});

  // Initialize MediaBunnyManager
  useEffect(() => {
    const manager = new MediaBunnyManager();
    setMediaBunnyManager(manager);
  }, []);

  // Fetch project data from Convex
  const data = useQuery(
    api.video.getProjectWithAllData,
    projectId ? { projectId: projectId as Id<"videoProjects"> } : "skip"
  );

  const clips = data?.clips ?? [];

  // Transform Convex clip to Sequence and update mediaAssets
  const selectedSequence = useMemo(() => {
    if (!selectedClipId) {
      return null;
    }

    const selectedClip = clips.find((c) => c._id === selectedClipId);
    if (!selectedClip) {
      return null;
    }

    const videoUrl =
      selectedClip.lipsyncVideoUrl ??
      selectedClip.videoUrl ??
      selectedClip.originalVideoUrl ??
      "";

    if (!videoUrl) {
      return null;
    }

    // Create/update MediaAssetMeta from Convex clip
    const asset: MediaAssetMeta = mediaAssets[selectedClip._id] || {
      id: selectedClip._id,
      name: `Clip ${selectedClip._id}`,
      type: "video",
      duration: selectedClip.duration ?? 10,
      width: selectedClip.width ?? 1920,
      height: selectedClip.height ?? 1080,
      fps: 30,
      url: videoUrl,
    };

    // Update mediaAssets if needed (preserve thumbnails if they exist)
    if (!mediaAssets[selectedClip._id]) {
      setMediaAssets((prev) => ({ ...prev, [asset.id]: asset }));
    }

    // Create a simple sequence with one clip
    const sequence: Sequence = {
      id: "preview-sequence",
      name: "Preview",
      width: asset.width,
      height: asset.height,
      fps: 30,
      sampleRate: 48000,
      duration: asset.duration,
      tracks: [
        {
          id: "video-track",
          kind: "video",
          allowOverlap: false,
          clips: [
            {
              id: selectedClip._id,
              mediaId: selectedClip._id,
              trackId: "video-track",
              kind: "video",
              start: 0,
              duration: asset.duration,
              trimStart: 0,
              trimEnd: asset.duration,
              opacity: 1,
              volume: 1,
              effects: [],
              transitions: [],
              speedCurve: null,
              preservePitch: true,
            },
          ],
          locked: false,
          muted: false,
          volume: 1,
        },
      ],
    };

    return sequence;
  }, [selectedClipId, clips, mediaAssets]);

  // Generate single thumbnail for selected clip (to loop in timeline)
  useEffect(() => {
    if (!mediaBunnyManager || !selectedClipId || !selectedSequence) return;

    const asset = mediaAssets[selectedClipId];
    if (!asset || asset.thumbnails?.length) return; // Skip if already has thumbnails

    console.log('Generating thumbnails for clip:', selectedClipId);

    // Generate 6 thumbnails spread across video to loop
    mediaBunnyManager
      .generateThumbnails(asset.id, asset.url, asset.duration, 6)
      .then((thumbs) => {
        if (!thumbs?.length) {
          console.warn('No thumbnails generated for clip:', selectedClipId);
          return;
        }
        console.log('6 thumbnails generated - will loop across clip');
        setMediaAssets((prev) => ({
          ...prev,
          [asset.id]: { ...asset, thumbnails: thumbs, thumbnailCount: thumbs.length },
        }));
      })
      .catch((error) => {
        console.warn('Failed to generate thumbnail for clip:', selectedClipId, error);
      });
  }, [selectedClipId, selectedSequence, mediaAssets, mediaBunnyManager]);

  // Extract actual video dimensions
  useEffect(() => {
    if (!selectedClipId || !selectedSequence) return;

    const asset = mediaAssets[selectedClipId];
    if (!asset || (asset.width !== 1920 && asset.width !== undefined && asset.height !== 1080 && asset.height !== undefined)) return; // Skip if already has real dimensions

    console.log('Extracting video dimensions for clip:', selectedClipId);

    // Create temporary VideoLoader to get dimensions
    import('@/lib/editor/playback/video-loader').then(({ VideoLoader }) => {
      const loader = new VideoLoader(asset, { cacheSize: 10 });

      loader.getVideoDimensions()
        .then((dimensions) => {
          console.log('Extracted dimensions:', dimensions);
          setMediaAssets((prev) => ({
            ...prev,
            [asset.id]: { ...asset, ...dimensions },
          }));
        })
        .catch((error) => {
          console.warn('Failed to extract video dimensions:', error);
        })
        .finally(() => {
          loader.dispose();
        });
    });
  }, [selectedClipId, selectedSequence, mediaAssets]);

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // Use useEffect to properly manage event listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const mouseY = e.clientY - containerRect.top;
      const newVideoHeight = (mouseY / containerRect.height) * 100;

      // Constrain between 30% and 70%
      const constrainedHeight = Math.max(30, Math.min(70, newVideoHeight));
      setVideoHeight(constrainedHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    // Cleanup function
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const sidebarButtons = [
    { id: 'media' as PanelType, icon: Image, label: 'Media' },
    { id: 'text' as PanelType, icon: Type, label: 'Text' },
    { id: 'captions' as PanelType, icon: Subtitles, label: 'Captions' },
    { id: 'transitions' as PanelType, icon: Shuffle, label: 'Transitions' },
    { id: 'effects' as PanelType, icon: Sparkles, label: 'Effects' },
  ];

  return (
    <div className="h-screen w-full bg-black text-white relative">
      <div className="h-full grid" style={{
        gridTemplateColumns: isPanelOpen ? "64px 320px 1fr" : "64px 0px 1fr",
      }}>
        {/* Left Sidebar */}
        <aside className="bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-4 gap-2">
          {sidebarButtons.map((button) => {
            const Icon = button.icon;
            const isActive = activePanel === button.id;

            return (
              <button
                key={button.id}
                onClick={() => {
                  setActivePanel(button.id);
                  setIsPanelOpen(true);
                }}
                className={`
                  w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-1 transition-all group cursor-pointer
                  ${isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                  }
                `}
                title={button.label}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{button.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Content Panel */}
        <aside
          className="bg-zinc-900 border-r border-zinc-800 overflow-hidden transition-all duration-300"
          style={{ width: isPanelOpen ? "320px" : "0px" }}
        >
          {activePanel === 'media' && (
            <MediaLibraryPanel
              projectId={projectId}
              onClipSelect={(clipId) => {
                setSelectedClipId(clipId);
                setCurrentTime(0);
                setIsPlaying(false);
              }}
              selectedClipId={selectedClipId}
            />
          )}

          {activePanel === 'text' && (
            <TextPanel
              onSelectText={(preset) => console.log('Selected text preset:', preset)}
            />
          )}

          {activePanel === 'captions' && (
            <CaptionsPanel
              onSelectStyle={(style) => console.log('Selected caption style:', style)}
              onGenerateCaptions={() => console.log('Generate captions clicked')}
            />
          )}

          {activePanel === 'transitions' && (
            <TransitionLibrary
              onSelectTransition={(transition) => console.log('Selected transition:', transition)}
            />
          )}

          {activePanel === 'effects' && (
            <FilterLibrary
              onSelectFilter={(filter) => console.log('Selected filter:', filter)}
            />
          )}
        </aside>

        {/* Main Content Area */}
        <main
          ref={containerRef}
          className="grid overflow-hidden"
          style={{
            gridTemplateRows: `${videoHeight}% auto ${100 - videoHeight}%`,
          }}
        >
          {/* Video Player Area (contains player + controls) */}
          <div className="flex flex-col overflow-hidden">
            {/* Video Player */}
            <section className="flex-1 bg-black flex items-center justify-center overflow-hidden">
            {selectedSequence && Object.keys(mediaAssets).length > 0 ? (
              <VideoPlayer
                sequence={selectedSequence}
                mediaAssets={mediaAssets}
                currentTime={currentTime}
                isPlaying={isPlaying}
                masterVolume={1.0}
                onTimeUpdate={(time) => setCurrentTime(time)}
                onEnded={() => setIsPlaying(false)}
                onError={(error) => {
                  console.error("Video player error:", error);
                  alert(`Player Error: ${error.message}`);
                }}
                className="w-full h-full"
              />
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <div className="w-0 h-0 border-l-8 border-l-white border-t-6 border-t-transparent border-b-6 border-b-transparent ml-1" />
                </div>
                <p className="text-sm text-zinc-500">
                  {clips.length === 0
                    ? "No videos available"
                    : "Select a video from the media library"}
                </p>
              </div>
            )}
            </section>
          </div>

          {/* Resizable Divider */}
          <div
            onMouseDown={handleDividerMouseDown}
            className="h-2 bg-zinc-900 hover:bg-zinc-700 cursor-ns-resize border-y border-zinc-800 flex items-center justify-center transition-colors group"
          >
            <div className="w-16 h-0.5 bg-zinc-700 group-hover:bg-zinc-500 rounded-full transition-colors" />
          </div>

          {/* Timeline Editor */}
          <section className="bg-zinc-950 overflow-hidden">
            {selectedSequence ? (
              <Timeline
                sequence={selectedSequence}
                mediaAssets={mediaAssets}
                currentTime={currentTime}
                isPlaying={isPlaying}
                selectedClipIds={[]}
                duration={selectedSequence.duration}
                onPlayPause={() => setIsPlaying(!isPlaying)}
                onSeek={(time) => setCurrentTime(time)}
                onClipMove={(clipId, start, trackId) => {
                  console.log('Clip moved:', { clipId, start, trackId })
                  // TODO: Implement clip moving logic when we have multi-clip editing
                }}
                onClipTrim={(clipId, trimStart, trimEnd) => {
                  console.log('Clip trimmed:', { clipId, trimStart, trimEnd })
                  // TODO: Implement clip trimming logic
                }}
                onClipSelect={(clipIds) => {
                  console.log('Clips selected:', clipIds)
                  // TODO: Implement clip selection logic
                }}
                onClipDelete={(clipIds) => {
                  console.log('Clips deleted:', clipIds)
                  // TODO: Implement clip deletion logic
                }}
                magneticSnapEnabled={true}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="flex gap-2 mb-3 justify-center">
                    <div className="w-12 h-8 bg-blue-600/20 border border-blue-600/40 rounded" />
                    <div className="w-16 h-8 bg-purple-600/20 border border-purple-600/40 rounded" />
                    <div className="w-14 h-8 bg-green-600/20 border border-green-600/40 rounded" />
                  </div>
                  <p className="text-sm text-zinc-500">
                    {clips.length === 0
                      ? "No videos available"
                      : "Select a video to see timeline"}
                  </p>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Toggle Button - Absolutely Positioned */}
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="absolute top-1/2 -translate-y-1/2 z-50 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center transition-all shadow-lg cursor-pointer"
        style={{
          left: isPanelOpen ? "384px" : "64px", // 64px (sidebar) + 320px (panel) or just 64px
          width: "24px",
          height: "64px",
          borderTopRightRadius: "12px",
          borderBottomRightRadius: "12px",
          borderLeft: "none",
        }}
      >
        {isPanelOpen ? (
          <ChevronLeft className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        )}
      </button>
    </div>
  );
}
