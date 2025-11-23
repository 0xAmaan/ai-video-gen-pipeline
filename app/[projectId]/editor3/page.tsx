"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
import type { Sequence, MediaAssetMeta, Clip } from "@/lib/editor/types";
import { getClipAtTime, splitClipAtTime } from "@/lib/editor/utils/clip-operations";

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
  const [selectedTimelineClipIds, setSelectedTimelineClipIds] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mediaBunnyManager, setMediaBunnyManager] = useState<MediaBunnyManager | null>(null);
  const [mediaAssets, setMediaAssets] = useState<Record<string, MediaAssetMeta>>({});
  const [clipPositionOverrides, setClipPositionOverrides] = useState<Record<string, number>>({});
  const [modifiedClips, setModifiedClips] = useState<Clip[] | null>(null);
  const timelineSectionRef = useRef<HTMLElement | null>(null);

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

  // Transform all Convex clips to a timeline Sequence and update mediaAssets
  const selectedSequence = useMemo(() => {
    if (clips.length === 0) {
      return null;
    }

    // Process all clips and create media assets
    const timelineClips: any[] = [];
    let currentStart = 0;
    let totalDuration = 0;
    let sequenceWidth = 1920;
    let sequenceHeight = 1080;

    clips.forEach((clip) => {
      const videoUrl =
        clip.lipsyncVideoUrl ??
        clip.videoUrl ??
        clip.originalVideoUrl ??
        "";

      // Skip clips with no valid URL (including empty strings)
      if (!videoUrl || videoUrl.trim() === "") {
        console.warn('Skipping clip with no valid video URL:', {
          clipId: clip._id,
          lipsyncVideoUrl: clip.lipsyncVideoUrl,
          videoUrl: clip.videoUrl,
          originalVideoUrl: clip.originalVideoUrl
        });
        return;
      }

      // Parse resolution (e.g., "1920x1080") or use defaults
      let width = 1920;
      let height = 1080;
      if (clip.resolution) {
        const [w, h] = clip.resolution.split('x').map(Number);
        if (w && h) {
          width = w;
          height = h;
        }
      }

      // Create/update MediaAssetMeta from Convex clip
      const asset: MediaAssetMeta = mediaAssets[clip._id] || {
        id: clip._id,
        name: `Clip ${clip._id}`,
        type: "video",
        duration: clip.duration ?? 10,
        width,
        height,
        fps: 30,
        url: videoUrl,
      };

      // Update mediaAssets if needed (preserve thumbnails if they exist)
      if (!mediaAssets[clip._id]) {
        setMediaAssets((prev) => ({ ...prev, [asset.id]: asset }));
      }

      // Track max dimensions for sequence
      if (asset.width > sequenceWidth) sequenceWidth = asset.width;
      if (asset.height > sequenceHeight) sequenceHeight = asset.height;

      // Use position override if available, otherwise stack horizontally
      const clipStart = clipPositionOverrides[clip._id] !== undefined
        ? clipPositionOverrides[clip._id]
        : currentStart;

      // Add clip to timeline
      timelineClips.push({
        id: clip._id,
        mediaId: clip._id,
        trackId: "video-track",
        kind: "video",
        start: clipStart,
        duration: asset.duration,
        trimStart: 0,
        trimEnd: asset.duration,
        opacity: 1,
        volume: 1,
        effects: [],
        transitions: [],
        speedCurve: null,
        preservePitch: true,
      });

      // Only increment currentStart if not using override (for default stacking)
      if (clipPositionOverrides[clip._id] === undefined) {
        currentStart += asset.duration;
      }
      totalDuration += asset.duration;
    });

    if (timelineClips.length === 0) {
      return null;
    }

    // Create a sequence with all clips horizontally stacked
    const sequence: Sequence = {
      id: "timeline-sequence",
      name: "Timeline",
      width: sequenceWidth,
      height: sequenceHeight,
      fps: 30,
      sampleRate: 48000,
      duration: totalDuration,
      tracks: [
        {
          id: "video-track",
          kind: "video",
          allowOverlap: false,
          clips: modifiedClips || timelineClips,
          locked: false,
          muted: false,
          volume: 1,
        },
      ],
    };

    return sequence;
  }, [clips, mediaAssets, selectedClipId, clipPositionOverrides, modifiedClips]);

  // Generate thumbnails for all clips in the sequence
  useEffect(() => {
    if (!mediaBunnyManager || !selectedSequence) return;

    // Generate thumbnails for each clip that doesn't have them yet
    clips.forEach((clip) => {
      const asset = mediaAssets[clip._id];
      if (!asset || asset.thumbnails?.length) return; // Skip if already has thumbnails

      // Generate 6 thumbnails spread across video to loop
      mediaBunnyManager
        .generateThumbnails(asset.id, asset.url, asset.duration, 6)
        .then((thumbs) => {
          if (!thumbs?.length) {
            return;
          }
          setMediaAssets((prev) => ({
            ...prev,
            [asset.id]: { ...asset, thumbnails: thumbs, thumbnailCount: thumbs.length },
          }));
        })
        .catch((error) => {
          console.warn('Failed to generate thumbnail for clip:', clip._id, error);
        });
    });
  }, [clips, selectedSequence, mediaAssets, mediaBunnyManager]);

  // Extract actual video dimensions for all clips
  useEffect(() => {
    if (!selectedSequence) return;

    clips.forEach((clip) => {
      const asset = mediaAssets[clip._id];
      if (!asset || (asset.width !== 1920 && asset.width !== undefined && asset.height !== 1080 && asset.height !== undefined)) return; // Skip if already has real dimensions

      // Create temporary VideoLoader to get dimensions
      import('@/lib/editor/playback/video-loader').then(({ VideoLoader }) => {
        const loader = new VideoLoader(asset, { cacheSize: 10 });

        loader.getVideoDimensions()
          .then((dimensions) => {
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
    });
  }, [clips, selectedSequence, mediaAssets]);

  const handleSplitClip = useCallback(() => {
    if (!selectedSequence) {
      console.warn('No sequence available');
      return;
    }

    // Find clip at playhead position
    const clipToSplit = getClipAtTime(selectedSequence, currentTime);

    if (!clipToSplit) {
      console.warn('No clip at playhead position');
      return;
    }

    // Split the clip
    const result = splitClipAtTime(clipToSplit, currentTime);

    if (!result) {
      // splitClipAtTime already logs the reason for failure
      return;
    }

    const [leftClip, rightClip] = result;

    // Update the clips in the sequence
    const currentClips = selectedSequence.tracks[0].clips;
    const newClips = currentClips.flatMap(clip =>
      clip.id === clipToSplit.id ? [leftClip, rightClip] : [clip]
    );

    // Update modified clips state
    setModifiedClips(newClips);

    // Select the right clip after split
    setSelectedTimelineClipIds([rightClip.id]);

    console.log('Split clip successfully:', {
      original: clipToSplit.id,
      left: leftClip.id,
      right: rightClip.id,
      splitTime: currentTime
    });
  }, [selectedSequence, currentTime]);

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

  // Keyboard shortcut handler for clip splitting (Cmd+B / Ctrl+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+B (Mac) or Ctrl+B (Windows/Linux)
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleSplitClip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSplitClip]);

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
                  console.error("Current sequence clips:", selectedSequence?.tracks[0]?.clips.map(c => ({
                    id: c.id,
                    mediaId: c.mediaId,
                    url: mediaAssets[c.mediaId]?.url
                  })));

                  // Find which clip might be failing
                  const currentClip = selectedSequence?.tracks[0]?.clips.find(
                    clip => currentTime >= clip.start && currentTime < clip.start + clip.duration
                  );

                  const errorDetails = currentClip
                    ? `${error.message}\n\nClip: ${currentClip.id}\nURL: ${mediaAssets[currentClip.mediaId]?.url || 'unknown'}`
                    : error.message;

                  alert(`Player Error: ${errorDetails}`);
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
          <section ref={timelineSectionRef} className="bg-zinc-950 overflow-hidden">
            {selectedSequence ? (
              <Timeline
                sequence={selectedSequence}
                mediaAssets={mediaAssets}
                currentTime={currentTime}
                isPlaying={isPlaying}
                selectedClipIds={selectedTimelineClipIds}
                duration={selectedSequence.duration}
                timelineSectionRef={timelineSectionRef}
                onPlayPause={() => setIsPlaying(!isPlaying)}
                onSeek={(time) => setCurrentTime(time)}
                onClipMove={(updates) => {
                  console.log('Clips moved:', updates)

                  if (!selectedSequence) return;

                  // Get current clips from sequence
                  const currentClips = selectedSequence.tracks[0]?.clips || [];

                  // Create a map of updates
                  const updateMap = new Map(updates.map(u => [u.clipId, u]));

                  // Apply updates to clips and sort by new order
                  const updatedClips = currentClips.map(clip => {
                    const update = updateMap.get(clip.id);
                    if (update) {
                      return {
                        ...clip,
                        start: update.newStart
                      };
                    }
                    return clip;
                  });

                  // Sort by start position to maintain correct order
                  updatedClips.sort((a, b) => a.start - b.start);

                  // Update modified clips state
                  setModifiedClips(updatedClips);

                  // Note: This updates local state only. On page refresh, clips will return to default positions.
                  // To persist, we would need to add a position field to the Convex videoClips schema
                  // or implement clip ordering logic.
                }}
                onClipTrim={(clipId, trimStart, trimEnd) => {
                  console.log('Clip trimmed:', { clipId, trimStart, trimEnd })
                  // TODO: Implement clip trimming logic
                }}
                onClipSelect={(clipIds) => {
                  setSelectedTimelineClipIds(clipIds)
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
