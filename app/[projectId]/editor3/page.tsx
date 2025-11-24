"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Image, Type, Subtitles, Shuffle, Sparkles, ChevronLeft, ChevronRight, Play, Pause, Download } from "lucide-react";
import { TextPanel } from "@/components/editor/TextPanel";
import { CaptionsPanel } from "@/components/editor/CaptionsPanel";
import { TransitionLibrary } from "@/components/editor/TransitionLibrary";
import { FilterLibrary } from "@/components/editor/FilterLibrary";
import { MediaLibraryPanel } from "@/components/editor3/MediaLibraryPanel";
import { VideoPlayer } from "@/components/editor/VideoPlayer";
import { Timeline } from "@/components/timeline";
import { MediaBunnyManager } from "@/lib/editor/io/media-bunny-manager";
import type { Sequence, MediaAssetMeta, Clip, Project } from "@/lib/editor/types";
import { getClipAtTime, splitClipAtTime } from "@/lib/editor/utils/clip-operations";
import { getExportPipeline } from "@/lib/editor/export/export-pipeline";
import { saveBlob } from "@/lib/editor/export/save-file";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/lib/editor/core/project-store";
import { adaptConvexProjectToStandalone } from "@/lib/editor/convex-adapter";
import { generateWaveform } from "@/lib/editor/audio/waveform-generator";

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
  const [modifiedTracks, setModifiedTracks] = useState<any[] | null>(null);
  const [additionalTracks, setAdditionalTracks] = useState<any[]>([]);
  const timelineSectionRef = useRef<HTMLElement | null>(null);

  // Export state
  const [exportStatus, setExportStatus] = useState<{progress: number; status: string} | null>(null);

  // Initialize MediaBunnyManager
  useEffect(() => {
    const manager = new MediaBunnyManager();
    setMediaBunnyManager(manager);
  }, []);

  // Initialize export manager
  const exportManager = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return getExportPipeline();
    } catch (error) {
      console.warn("Export disabled:", error);
      return null;
    }
  }, []);

  // Fetch project data from Convex
  const data = useQuery(
    api.video.getProjectWithAllData,
    projectId ? { projectId: projectId as Id<"videoProjects"> } : "skip"
  );

  const clips = data?.clips ?? [];

  // Use convex-adapter to transform Convex data to editor format (includes audio support!)
  const adaptedData = useMemo(() => {
    if (!data?.project || !data?.clips) return null;

    return adaptConvexProjectToStandalone({
      project: data.project,
      clips: data.clips,
      scenes: data.scenes ?? [],
      audioAssets: data.audioAssets ?? [],
    });
  }, [data]);

  // Get sequence and media assets from adapter
  const selectedSequence = useMemo(() => {
    if (!adaptedData) return null;

    // Get the first sequence (main timeline)
    const sequence = adaptedData.project.sequences[0];
    if (!sequence) return null;

    // Apply any modifications from user actions
    if (modifiedClips || modifiedTracks || additionalTracks.length > 0) {
      return {
        ...sequence,
        tracks: modifiedTracks || [
          ...sequence.tracks,
          ...additionalTracks,
        ],
      };
    }

    return sequence;
  }, [adaptedData, modifiedClips, modifiedTracks, additionalTracks]);

  // Update mediaAssets state when adapter data changes
  useEffect(() => {
    if (adaptedData?.project.mediaAssets) {
      setMediaAssets(adaptedData.project.mediaAssets);
    }
  }, [adaptedData]);

  // Generate waveforms for audio assets
  useEffect(() => {
    if (!adaptedData?.project.mediaAssets) return;

    const audioAssets = Object.values(adaptedData.project.mediaAssets).filter(
      (asset) => asset.type === "audio" && asset.url && !asset.waveform
    );

    audioAssets.forEach((asset) => {
      generateWaveform(asset.url)
        .then((waveformData) => {
          setMediaAssets((prev) => ({
            ...prev,
            [asset.id]: { ...asset, waveform: waveformData.samples },
          }));
        })
        .catch(() => {
          // Waveform generation failed silently
        });
    });
  }, [adaptedData]);

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
        .catch(() => {
          // Thumbnail generation failed silently
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
          .catch(() => {
            // Dimension extraction failed silently
          })
          .finally(() => {
            loader.dispose();
          });
      });
    });
  }, [clips, selectedSequence, mediaAssets]);

  const handleSplitClip = useCallback(() => {
    if (!selectedSequence) {
      return;
    }

    // Find clip at playhead position
    const clipToSplit = getClipAtTime(selectedSequence, currentTime);

    if (!clipToSplit) {
      return;
    }

    // Split the clip
    const result = splitClipAtTime(clipToSplit, currentTime);

    if (!result) {
      return;
    }

    const [leftClip, rightClip] = result;

    // Find which track contains the clip to split
    let trackWithClip: any = null;
    for (const track of selectedSequence.tracks) {
      if (track.clips.find((c: Clip) => c.id === clipToSplit.id)) {
        trackWithClip = track;
        break;
      }
    }

    if (!trackWithClip) {
      return;
    }

    // Update all tracks - replace the clip with left and right clips on its track
    const updatedTracks = selectedSequence.tracks.map(track => {
      if (track.id !== trackWithClip.id) {
        return track;
      }

      // Replace the clip with the split clips
      const newClips = track.clips.flatMap((clip: Clip) =>
        clip.id === clipToSplit.id ? [leftClip, rightClip] : [clip]
      );

      return { ...track, clips: newClips };
    });

    // Update both track and clip states
    setModifiedTracks(updatedTracks);

    // For backwards compatibility: also update modifiedClips
    const allClips = updatedTracks.flatMap(t => t.clips);
    setModifiedClips(allClips);

    // Select the right clip after split
    setSelectedTimelineClipIds([rightClip.id]);
  }, [selectedSequence, currentTime]);

  const handleDuplicateClip = useCallback(() => {
    if (!selectedSequence) {
      return;
    }

    if (selectedTimelineClipIds.length === 0) {
      return;
    }

    if (selectedTimelineClipIds.length > 1) {
      alert('Please select only one clip to duplicate');
      return;
    }

    const clipId = selectedTimelineClipIds[0];

    // Find which track contains the clip to duplicate
    let clipToDuplicate: Clip | null = null;
    let trackWithClip: any = null;

    for (const track of selectedSequence.tracks) {
      const found = track.clips.find((c: Clip) => c.id === clipId);
      if (found) {
        clipToDuplicate = found;
        trackWithClip = track;
        break;
      }
    }

    if (!clipToDuplicate || !trackWithClip) {
      return;
    }

    // Create duplicate with new ID
    const duplicate: Clip = {
      ...clipToDuplicate,
      id: `clip-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
      start: clipToDuplicate.start + clipToDuplicate.duration,
    };

    // Update all tracks - add duplicate to the same track and apply ripple insert
    const updatedTracks = selectedSequence.tracks.map(track => {
      if (track.id !== trackWithClip.id) {
        // Other tracks remain unchanged
        return track;
      }

      // This is the track containing the clip to duplicate
      const newClips = track.clips.map((clip: Clip) => {
        // Shift all clips after the duplicate position to the right
        if (clip.start >= duplicate.start && clip.id !== clipId) {
          return { ...clip, start: clip.start + duplicate.duration };
        }
        return clip;
      });

      // Insert duplicate and sort by start position
      newClips.push(duplicate);
      newClips.sort((a: Clip, b: Clip) => a.start - b.start);

      return { ...track, clips: newClips };
    });

    // Update both track and clip states
    setModifiedTracks(updatedTracks);

    // For backwards compatibility: also update modifiedClips
    const allClips = updatedTracks.flatMap(t => t.clips);
    setModifiedClips(allClips);

    // Select the duplicate
    setSelectedTimelineClipIds([duplicate.id]);
  }, [selectedSequence, selectedTimelineClipIds]);

  const handleDeleteClip = useCallback(() => {
    if (!selectedSequence) {
      return;
    }

    if (selectedTimelineClipIds.length === 0) {
      return;
    }

    if (selectedTimelineClipIds.length > 1) {
      alert('Please select only one clip to delete');
      return;
    }

    const clipId = selectedTimelineClipIds[0];

    // Find which track contains the clip to delete
    let clipToDelete: Clip | null = null;
    let trackWithClip: any = null;

    for (const track of selectedSequence.tracks) {
      const found = track.clips.find((c: Clip) => c.id === clipId);
      if (found) {
        clipToDelete = found;
        trackWithClip = track;
        break;
      }
    }

    if (!clipToDelete || !trackWithClip) {
      return;
    }

    // Update all tracks - remove the clip and apply ripple delete on its track
    const updatedTracks = selectedSequence.tracks.map(track => {
      if (track.id !== trackWithClip.id) {
        // Other tracks remain unchanged
        return track;
      }

      // This is the track containing the clip to delete
      const newClips = track.clips
        .filter((clip: Clip) => clip.id !== clipId)
        .map((clip: Clip) => {
          // Apply ripple delete - shift clips left if they're after the deleted clip
          if (clip.start > clipToDelete!.start) {
            return { ...clip, start: Math.max(0, clip.start - clipToDelete!.duration) };
          }
          return clip;
        });

      return { ...track, clips: newClips };
    });

    // Update both track and clip states
    setModifiedTracks(updatedTracks);

    // For backwards compatibility: also update modifiedClips
    const allClips = updatedTracks.flatMap(t => t.clips);
    setModifiedClips(allClips);

    // Clear selection
    setSelectedTimelineClipIds([]);
  }, [selectedSequence, selectedTimelineClipIds]);

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

  // Keyboard shortcuts (Cmd+B for split, Cmd+D for duplicate, Delete for delete, Space for play/pause)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Space for play/pause
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
        return;
      }

      // Delete or Backspace for delete clip
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteClip();
        return;
      }

      // Cmd+B (Mac) or Ctrl+B (Windows/Linux) for split
      // Cmd+D (Mac) or Ctrl+D (Windows/Linux) for duplicate
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleSplitClip();
        return;
      }

      if (modifier && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateClip();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSplitClip, handleDuplicateClip, handleDeleteClip, isPlaying]);

  // Export handler - uses default settings
  const handleExport = useCallback(async () => {
    if (!selectedSequence || !exportManager) {
      alert("Export is not available");
      return;
    }

    // Validate sequence has clips
    const hasClips = selectedSequence.tracks.some(track => track.clips.length > 0);
    if (!hasClips) {
      alert("Cannot export empty timeline");
      return;
    }

    // Validate all clips have accessible media assets
    const missingAssets: string[] = [];
    for (const track of selectedSequence.tracks) {
      for (const clip of track.clips) {
        if (!mediaAssets[clip.mediaId] || !mediaAssets[clip.mediaId].url) {
          missingAssets.push(clip.mediaId);
        }
      }
    }

    if (missingAssets.length > 0) {
      alert(`Cannot export: Missing media for clips: ${missingAssets.join(", ")}`);
      return;
    }

    // Convert to Project format
    const project: Project = {
      id: projectId,
      title: data?.project?.title || "Untitled",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sequences: [selectedSequence],
      mediaAssets: mediaAssets,
      settings: {
        snap: true,
        snapThreshold: 0.1,
        zoom: 1,
        activeSequenceId: selectedSequence.id,
      },
    };

    // Default export settings - 1080p high quality
    const defaultOptions = {
      resolution: "1080p",
      quality: "high",
      format: "mp4",
      aspectRatio: "16:9",
    };

    setExportStatus({ progress: 0, status: "Preparing" });

    try {
      const blob = await exportManager.exportProject(
        project,
        selectedSequence,
        defaultOptions,
        (progress, status) => {
          setExportStatus({ progress, status });
        }
      );

      await saveBlob(
        blob,
        `${project.title || "video"}.${defaultOptions.format}`
      );

      setExportStatus({ progress: 100, status: "Complete" });

      // Clear status after 2 seconds
      setTimeout(() => setExportStatus(null), 2000);
    } catch (error) {
      console.error("Export failed", error);
      setExportStatus(null);
      alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [selectedSequence, exportManager, mediaAssets, projectId, data?.project?.title]);

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
        gridTemplateColumns: isPanelOpen ? "64px 280px 1fr" : "64px 0px 1fr",
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
          style={{ width: isPanelOpen ? "280px" : "0px" }}
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
                  console.error("Current sequence clips:", selectedSequence?.tracks[0]?.clips.map((c: Clip) => ({
                    id: c.id,
                    mediaId: c.mediaId,
                    url: mediaAssets[c.mediaId]?.url
                  })));

                  // Find which clip might be failing
                  const currentClip = selectedSequence?.tracks[0]?.clips.find(
                    (clip: Clip) => currentTime >= clip.start && currentTime < clip.start + clip.duration
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
                key={selectedSequence.id}
                sequence={selectedSequence}
                mediaAssets={mediaAssets}
                currentTime={currentTime}
                isPlaying={isPlaying}
                selectedClipIds={selectedTimelineClipIds}
                duration={selectedSequence.duration}
                timelineSectionRef={timelineSectionRef}
                onPlayPause={() => setIsPlaying(prev => !prev)}
                onSeek={(time) => setCurrentTime(time)}
                onClipMove={(updates: { clipId: string; newStart: number; newTrackId?: string }[]) => {
                  if (!selectedSequence) return;

                  // Create a map of updates for quick lookup
                  const updateMap = new Map<string, { clipId: string; newStart: number; newTrackId?: string }>(
                    updates.map((u) => [u.clipId, u])
                  );

                  // Handle track changes - rebuild all track clip arrays
                  const updatedTracks = selectedSequence.tracks.map((track: Sequence["tracks"][number]) => {
                    // Get all clips for this track (both existing and newly moved)
                    let trackClips = track.clips.filter((clip: Clip) => {
                      const update = updateMap.get(clip.id);
                      // Keep clip if: (1) no update, or (2) update exists but no track change, or (3) update moves it TO this track
                      if (!update) return true;
                      if (!update.newTrackId) return true; // No track change
                      return update.newTrackId === track.id; // Moved TO this track
                    });

                    // Check if any clips were moved FROM other tracks TO this track
                    selectedSequence.tracks.forEach((otherTrack: Sequence["tracks"][number]) => {
                      if (otherTrack.id === track.id) return; // Skip same track
                      otherTrack.clips.forEach((clip: Clip) => {
                        const update = updateMap.get(clip.id);
                        if (update?.newTrackId === track.id) {
                          // This clip was moved TO this track
                          trackClips.push({ ...clip, trackId: track.id });
                        }
                      });
                    });

                    // Apply position updates and filter out moved clips
                    trackClips = trackClips
                      .filter((clip: Clip) => {
                        const update = updateMap.get(clip.id);
                        // Remove if moved to different track
                        if (update?.newTrackId && update.newTrackId !== track.id) return false;
                        return true;
                      })
                      .map((clip: Clip) => {
                        const update = updateMap.get(clip.id);
                        if (update) {
                          return {
                            ...clip,
                            start: update.newStart,
                            trackId: update.newTrackId || clip.trackId
                          };
                        }
                        return clip;
                      })
                      .sort((a: Clip, b: Clip) => a.start - b.start);

                    return { ...track, clips: trackClips };
                  });

                  // Update the tracks state with new clip positions
                  setModifiedTracks(updatedTracks);

                  // For single-track backwards compat: also update modifiedClips
                  const allClips = updatedTracks.flatMap(t => t.clips);
                  setModifiedClips(allClips);
                }}
                onClipTrim={(clipId, trimStart, trimEnd) => {
                  if (!selectedSequence) return

                  // Update tracks - find and update the clip's trim values
                  const updatedTracks = selectedSequence.tracks.map(track => {
                    const clipIndex = track.clips.findIndex((c: Clip) => c.id === clipId)
                    if (clipIndex === -1) return track

                    // Update the clip's trim values
                    const updatedClips = [...track.clips]
                    const oldClip = updatedClips[clipIndex]
                    updatedClips[clipIndex] = {
                      ...oldClip,
                      trimStart,
                      trimEnd,
                    }

                    return { ...track, clips: updatedClips }
                  })

                  // Update state
                  setModifiedTracks(updatedTracks)

                  // For backwards compatibility
                  const allClips = updatedTracks.flatMap(t => t.clips)
                  setModifiedClips(allClips)
                }}
                onClipSelect={(clipIds) => {
                  setSelectedTimelineClipIds(clipIds)
                }}
                onClipDelete={(clipIds) => {
                  if (clipIds.length === 0) return;

                  if (clipIds.length > 1) {
                    alert('Please select only one clip to delete');
                    return;
                  }

                  const clipId = clipIds[0];
                  if (!selectedSequence) return;

                  // Find which track contains the clip to delete
                  let clipToDelete: Clip | null = null;
                  let trackWithClip: any = null;

                  for (const track of selectedSequence.tracks) {
                    const found = track.clips.find((c: Clip) => c.id === clipId);
                    if (found) {
                      clipToDelete = found;
                      trackWithClip = track;
                      break;
                    }
                  }

                  if (!clipToDelete || !trackWithClip) return;

                  // Update all tracks - remove the clip and apply ripple delete on its track
                  const updatedTracks = selectedSequence.tracks.map(track => {
                    if (track.id !== trackWithClip.id) {
                      return track;
                    }

                    const newClips = track.clips
                      .filter((clip: Clip) => clip.id !== clipId)
                      .map((clip: Clip) => {
                        if (clip.start > clipToDelete!.start) {
                          return { ...clip, start: Math.max(0, clip.start - clipToDelete!.duration) };
                        }
                        return clip;
                      });

                    return { ...track, clips: newClips };
                  });

                  setModifiedTracks(updatedTracks);
                  const allClips = updatedTracks.flatMap(t => t.clips);
                  setModifiedClips(allClips);
                  setSelectedTimelineClipIds([]);
                }}
                onClipDuplicate={(clipId) => {
                  if (!selectedSequence) return;

                  // Find which track contains the clip to duplicate
                  let clipToDuplicate: Clip | null = null;
                  let trackWithClip: any = null;

                  for (const track of selectedSequence.tracks) {
                    const found = track.clips.find((c: Clip) => c.id === clipId);
                    if (found) {
                      clipToDuplicate = found;
                      trackWithClip = track;
                      break;
                    }
                  }

                  if (!clipToDuplicate || !trackWithClip) return;

                  // Create duplicate with new ID
                  const duplicate: Clip = {
                    ...clipToDuplicate,
                    id: `clip-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
                    start: clipToDuplicate.start + clipToDuplicate.duration,
                  };

                  // Update all tracks - add duplicate to the same track and apply ripple insert
                  const updatedTracks = selectedSequence.tracks.map((track: Sequence["tracks"][number]) => {
                    if (track.id !== trackWithClip.id) {
                      return track;
                    }

                    const newClips = track.clips.map((clip: Clip) => {
                      if (clip.start >= duplicate.start && clip.id !== clipId) {
                        return { ...clip, start: clip.start + duplicate.duration };
                      }
                      return clip;
                    });

                    newClips.push(duplicate);
                    newClips.sort((a: Clip, b: Clip) => a.start - b.start);

                    return { ...track, clips: newClips };
                  });

                  setModifiedTracks(updatedTracks);
                  const allClips = updatedTracks.flatMap((t) => t.clips);
                  setModifiedClips(allClips);
                  setSelectedTimelineClipIds([duplicate.id]);
                }}
                onClipAdd={(mediaId, trackId, startTime) => {
                  if (!selectedSequence) return;

                  // Get the media asset for this clip
                  const asset = mediaAssets[mediaId];
                  if (!asset) {
                    console.error('Media asset not found:', mediaId);
                    return;
                  }

                  // Create a new clip
                  const newClip: Clip = {
                    id: `clip-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
                    mediaId: mediaId,
                    trackId: trackId,
                    kind: asset.type === 'audio' ? 'audio' : 'video',
                    start: startTime,
                    duration: asset.duration,
                    trimStart: 0,
                    trimEnd: 0,
                    opacity: 1,
                    volume: 1,
                    effects: [],
                    transitions: [],
                    speedCurve: null,
                    preservePitch: true,
                    blendMode: 'normal',
                  };

                  // Update tracks - add clip to the specified track
                  const updatedTracks = selectedSequence.tracks.map(track => {
                    if (track.id !== trackId) {
                      return track;
                    }

                    // Add new clip and sort by start time
                    const newClips = [...track.clips, newClip].sort((a, b) => a.start - b.start);
                    return { ...track, clips: newClips };
                  });

                  // Update state
                  setModifiedTracks(updatedTracks);

                  // For backwards compatibility
                  const allClips = updatedTracks.flatMap(t => t.clips);
                  setModifiedClips(allClips);

                  // Select the new clip
                  setSelectedTimelineClipIds([newClip.id]);
                }}
                onTrackAdd={(kind) => {
                  if (!selectedSequence) return;

                  // Find highest zIndex across all tracks
                  const maxZIndex = selectedSequence.tracks.reduce((max, t) => Math.max(max, t.zIndex), 0);
                  const tracksOfKind = selectedSequence.tracks.filter(t => t.kind === kind);
                  const trackNumber = tracksOfKind.length + 1;

                  // Create new track with 60px height (matching baseline)
                  const newTrack = {
                    id: `${kind}-track-${Date.now()}`,
                    name: `${kind.charAt(0).toUpperCase() + kind.slice(1)} ${trackNumber}`,
                    kind,
                    allowOverlap: kind !== "video",
                    locked: false,
                    muted: false,
                    solo: false,
                    volume: 1,
                    zIndex: maxZIndex + 1,
                    height: 60,
                    visible: true,
                    clips: [],
                  };

                  // Add to additional tracks state
                  setAdditionalTracks(prev => [...prev, newTrack]);
                }}
                onTrackRemove={(trackId) => {
                  // TODO: Implement track removal
                }}
                onTrackUpdate={(trackId, updates) => {
                  // TODO: Implement track update
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
          left: isPanelOpen ? "344px" : "64px", // 64px (sidebar) + 280px (panel) or just 64px
          width: "16px",
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

      {/* Export FAB - Floating Action Button */}
      <Button
        onClick={handleExport}
        disabled={!!exportStatus}
        className="fixed top-4 right-4 z-50 gap-2 shadow-lg"
        size="default"
      >
        <Download className="h-4 w-4" />
        {exportStatus ? `${Math.round(exportStatus.progress)}%` : "Export"}
      </Button>
    </div>
  );
}
