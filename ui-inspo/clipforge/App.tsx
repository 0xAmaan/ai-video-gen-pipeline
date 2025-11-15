import { useEffect, useRef, useState } from "react";
import { MediaLibrary } from "./components/MediaLibrary";
import { Timeline } from "./components/Timeline";
import { VideoPlayer, VideoPlayerHandle } from "./components/VideoPlayer";
import VideoInfoPanel from "./components/VideoInfoPanel";
import { Film } from "lucide-react";
import "./index.css";
import {
  Clip,
  MediaItem,
  ProjectState,
  RecordingState,
  VideoMetadata,
} from "./types";
import {
  addClip,
  calculateTotalDuration,
  createClip,
  getClipAtTime,
  moveClip,
  reflowClips,
  removeClip,
  splitClip,
  updateClipTrim,
} from "./utils/clipManagement";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

const App = () => {
  // Multi-clip project state
  const [projectState, setProjectState] = useState<ProjectState>({
    clips: [],
    selectedClipId: null,
    currentTime: 0,
    totalDuration: 0,
    isPlaying: false,
  });

  const [error, setError] = useState<string | null>(null);

  // Media library state
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);

  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPicking: false,
    selectedSource: null,
    startTime: null,
    elapsedTime: 0,
    mode: "screen", // Default to screen recording
  });

  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [scrubDisplayTime, setScrubDisplayTime] = useState<number | null>(null);
  const [scrubClipId, setScrubClipId] = useState<string | null>(null);

  const videoPlayerRef = useRef<VideoPlayerHandle>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const elapsedTimeRef = useRef<number>(0);
  const recordingOutputPathRef = useRef<string | null>(null);
  const isScrubbingRef = useRef<boolean>(false);
  const scrubTimeRef = useRef<number | null>(null);

  // Webcam recording refs
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Track if initial load is complete
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);

  // Load persisted media library on mount
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const items = await window.electronAPI.loadMediaLibrary();
        setMediaLibrary(items);
        setIsLibraryLoaded(true);
      } catch (err) {
        console.error("Failed to load media library:", err);
        setIsLibraryLoaded(true);
      }
    };
    loadLibrary();
  }, []);

  // Save media library whenever it changes (but not on initial load)
  useEffect(() => {
    if (!isLibraryLoaded) return; // Don't save until initial load is complete

    const saveLibrary = async () => {
      try {
        await window.electronAPI.saveMediaLibrary(mediaLibrary);
        console.log("Media library saved:", mediaLibrary.length, "items");
      } catch (err) {
        console.error("Failed to save media library:", err);
      }
    };
    saveLibrary();
  }, [mediaLibrary, isLibraryLoaded]);

  // Update elapsed time during recording
  useEffect(() => {
    if (recordingState.isRecording && recordingState.startTime) {
      const startTime = recordingState.startTime;
      recordingStartTimeRef.current = startTime;

      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        elapsedTimeRef.current = elapsed; // Store in ref for immediate access
        setRecordingState((prev) => ({
          ...prev,
          elapsedTime: elapsed,
        }));
      }, 100);

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
      };
    }
  }, [recordingState.isRecording, recordingState.startTime]);

  /**
   * Shared video import logic - used by both file picker and drag-drop
   * Only adds to media library, does NOT add to timeline
   */
  const importVideoFile = async (filePath: string) => {
    // Check if already in library
    const existingItem = mediaLibrary.find(
      (item) => item.filePath === filePath,
    );
    if (existingItem) {
      // Already in library, nothing to do
      console.log("Video already in library:", existingItem.fileName);
      return;
    }

    // Fetch video metadata
    const videoMetadata = await window.electronAPI.getVideoMetadata(filePath);

    // Generate thumbnail
    const thumbnail = await window.electronAPI.generateThumbnail(filePath);

    // Get file size
    const fileSize = await window.electronAPI.getFileSize(filePath);

    // Create media item
    const fileName = filePath.split("/").pop() || "Unknown";
    const resolution = `${videoMetadata.width}x${videoMetadata.height}`;
    const newMediaItem: MediaItem = {
      id: crypto.randomUUID(),
      filePath,
      fileName,
      thumbnail,
      duration: videoMetadata.duration,
      resolution,
      fileSize,
      addedAt: Date.now(),
    };

    // Add to media library only (not to timeline)
    setMediaLibrary((prev) => [...prev, newMediaItem]);
  };

  /**
   * Handle file drop - processes dropped video files
   */
  const handleFileDrop = async (filePath: string) => {
    setError(null);

    try {
      await importVideoFile(filePath);
    } catch (err) {
      console.error("Failed to import dropped video:", err);
      setError(err instanceof Error ? err.message : "Failed to import video");
    }
  };

  /**
   * Handle video import - creates a new clip on timeline AND adds to media library
   * Opens file picker and loads video metadata
   */
  const handleImport = async () => {
    setError(null);

    try {
      // Open file picker via IPC
      const filePath = await window.electronAPI.openFile();

      if (!filePath) {
        return; // User cancelled
      }

      await importVideoFile(filePath);
    } catch (err) {
      console.error("Failed to import video:", err);
      setError(err instanceof Error ? err.message : "Failed to import video");
    }
  };

  /**
   * Handle video time updates (from video playback)
   * Note: time parameter is the source video time, need to convert to timeline time
   */
  const handleTimeUpdate = (sourceTime: number) => {
    // Don't update state if we're currently scrubbing (preview only)
    if (isScrubbingRef.current) {
      return;
    }

    const currentClip = getClipAtTime(
      projectState.clips,
      projectState.currentTime,
    );

    if (!currentClip) return;

    // Convert source time to timeline time
    const offsetIntoClip = sourceTime - currentClip.sourceStart;
    const timelineTime = currentClip.timelineStart + offsetIntoClip;

    // Check if we've reached the end of the current clip
    if (sourceTime >= currentClip.sourceEnd) {
      // Find the next clip on the timeline
      const sortedClips = [...projectState.clips].sort(
        (a, b) => a.timelineStart - b.timelineStart,
      );
      const currentClipIndex = sortedClips.findIndex(
        (clip) => clip.id === currentClip.id,
      );
      const nextClip =
        currentClipIndex >= 0 && currentClipIndex < sortedClips.length - 1
          ? sortedClips[currentClipIndex + 1]
          : null;

      if (nextClip) {
        // Transition to the next clip - preserve playing state
        setProjectState((prev) => {
          const wasPlaying = prev.isPlaying;
          
          // Ensure video player continues if it was playing
          if (wasPlaying && videoPlayerRef.current) {
            // Use requestAnimationFrame to ensure state has updated
            requestAnimationFrame(() => {
              if (videoPlayerRef.current) {
                videoPlayerRef.current.play();
              }
            });
          }
          
          return {
            ...prev,
            currentTime: nextClip.timelineStart,
            isPlaying: wasPlaying, // Explicitly preserve playing state
          };
        });
      } else {
        // No more clips, stop playback at the end
        setProjectState((prev) => ({
          ...prev,
          currentTime: projectState.totalDuration,
          isPlaying: false,
        }));
        if (videoPlayerRef.current) {
          videoPlayerRef.current.pause();
        }
      }
    } else {
      // Normal time update within the clip
      setProjectState((prev) => ({
        ...prev,
        currentTime: timelineTime,
      }));
    }
  };

  /**
   * Handle play/pause state changes
   */
  const handlePlayPause = (isPlaying: boolean) => {
    setProjectState((prev) => ({
      ...prev,
      isPlaying,
    }));
  };

  /**
   * Handle seeking from timeline
   * Note: time parameter is timeline time, need to convert to source time for the clip
   */
  const handleSeek = (timelineTime: number) => {
    // Clear scrubbing state when seeking
    isScrubbingRef.current = false;
    scrubTimeRef.current = null;
    setScrubDisplayTime(null);
    setScrubClipId(null);

    setProjectState((prev) => ({
      ...prev,
      currentTime: timelineTime,
    }));

    // Seek the video player if it exists
    if (videoPlayerRef.current) {
      const clipAtTime = getClipAtTime(projectState.clips, timelineTime);
      if (clipAtTime) {
        const sourceTime = getSourceTimeForClip(clipAtTime, timelineTime);
        videoPlayerRef.current.seek(sourceTime);
      }
    }
  };

  /**
   * Handle scrubbing over timeline (for preview without actually seeking)
   * Note: time parameter is timeline time, need to convert to source time for the clip
   */
  const handleScrub = (timelineTime: number) => {
    // Only seek the video player for preview when paused, don't update currentTime state
    if (!projectState.isPlaying && videoPlayerRef.current) {
      const clipAtTime = getClipAtTime(projectState.clips, timelineTime);
      if (clipAtTime) {
        isScrubbingRef.current = true; // Set flag to prevent state updates
        scrubTimeRef.current = timelineTime; // Store scrub time for display
        setScrubDisplayTime(timelineTime); // Update display time state
        setScrubClipId(clipAtTime.id); // Track which clip we're scrubbing
        const sourceTime = getSourceTimeForClip(clipAtTime, timelineTime);
        videoPlayerRef.current.seek(sourceTime);
      }
    }
  };

  /**
   * Handle when scrubbing ends (mouse leaves timeline)
   */
  const handleScrubEnd = () => {
    isScrubbingRef.current = false; // Clear scrubbing flag
    scrubTimeRef.current = null; // Clear scrub time
    setScrubDisplayTime(null); // Clear display time
    setScrubClipId(null); // Clear scrub clip
  };

  /**
   * Handle clip selection
   */
  const handleClipSelect = (clipId: string) => {
    setProjectState((prev) => ({
      ...prev,
      selectedClipId: clipId,
    }));
  };

  /**
   * Handle clip movement/reordering on timeline
   */
  const handleClipMove = (clipId: string, newTimelineStart: number) => {
    const updatedClips = moveClip(projectState.clips, clipId, newTimelineStart);
    const newTotalDuration = calculateTotalDuration(updatedClips);

    setProjectState((prev) => ({
      ...prev,
      clips: updatedClips,
      totalDuration: newTotalDuration,
    }));
  };

  /**
   * Handle clip reordering from drag-and-drop
   */
  const handleClipReorder = (reorderedClips: Clip[]) => {
    const newTotalDuration = calculateTotalDuration(reorderedClips);

    setProjectState((prev) => ({
      ...prev,
      clips: reorderedClips,
      totalDuration: newTotalDuration,
    }));
  };

  /**
   * Handle trim changes for a specific clip
   */
  const handleClipTrim = (
    clipId: string,
    newSourceStart: number,
    newSourceEnd: number,
  ) => {
    const updatedClips = updateClipTrim(
      projectState.clips,
      clipId,
      newSourceStart,
      newSourceEnd,
    );
    // Reflow clips to auto-snap them together and remove gaps
    const reflowedClips = reflowClips(updatedClips);
    const newTotalDuration = calculateTotalDuration(reflowedClips);

    setProjectState((prev) => ({
      ...prev,
      clips: reflowedClips,
      totalDuration: newTotalDuration,
    }));
  };

  /**
   * Handle clip deletion
   */
  const handleClipDelete = (clipId: string) => {
    const updatedClips = removeClip(projectState.clips, clipId);
    const newTotalDuration = calculateTotalDuration(updatedClips);

    setProjectState((prev) => ({
      ...prev,
      clips: updatedClips,
      totalDuration: newTotalDuration,
      selectedClipId:
        prev.selectedClipId === clipId ? null : prev.selectedClipId,
    }));

    // Note: Thumbnails are NOT cleaned up here - they persist when clip is removed from timeline
    // Thumbnails are only cleaned up when the video is removed from the library entirely
  };

  /**
   * Handle clip splitting at playhead position
   */
  const handleSplitClip = (timelineTime: number) => {
    const clipToSplit = getClipAtTime(projectState.clips, timelineTime);
    if (!clipToSplit) {
      console.warn("No clip found at timeline time:", timelineTime);
      return;
    }

    const updatedClips = splitClip(projectState.clips, timelineTime);

    // If split failed (no clip at position or too close to edge), do nothing
    if (!updatedClips) {
      console.warn("Failed to split clip at timeline time:", timelineTime);
      return;
    }

    const newTotalDuration = calculateTotalDuration(updatedClips);

    // Mark the new clips as loading thumbnails
    const clipsWithLoadingState = updatedClips.map((clip) => {
      // Only mark clips that don't have thumbnails as loading
      if (!clip.thumbnails && clip.sourceFilePath === clipToSplit.sourceFilePath) {
        return { ...clip, thumbnailsLoading: true };
      }
      return clip;
    });

    setProjectState((prev) => ({
      ...prev,
      clips: clipsWithLoadingState,
      totalDuration: newTotalDuration,
    }));

    // Generate thumbnails for the new clips asynchronously
    const newClipsToGenerate = updatedClips.filter(
      (clip) =>
        !clip.thumbnails && clip.sourceFilePath === clipToSplit.sourceFilePath
    );

    newClipsToGenerate.forEach((clip) => {
      console.log("🎬 Generating thumbnails for split clip:", clip.id, {
        filePath: clip.sourceFilePath,
        sourceStart: clip.sourceStart,
        sourceEnd: clip.sourceEnd,
      });

      window.electronAPI
        .generateClipThumbnails(
          clip.sourceFilePath,
          clip.id,
          clip.sourceStart,
          clip.sourceEnd,
          5.0, // 1 frame every 5 seconds
        )
        .then((thumbnails) => {
          console.log("✅ Thumbnails generated for split clip:", thumbnails.length, "frames");

          // Update clip with generated thumbnails
          setProjectState((prev) => ({
            ...prev,
            clips: prev.clips.map((c) =>
              c.id === clip.id
                ? { ...c, thumbnails, thumbnailsLoading: false }
                : c
            ),
          }));
        })
        .catch((err) => {
          console.error("❌ Failed to generate thumbnails for split clip:", err);
          // Clear loading state even on error
          setProjectState((prev) => ({
            ...prev,
            clips: prev.clips.map((c) =>
              c.id === clip.id
                ? { ...c, thumbnailsLoading: false }
                : c
            ),
          }));
        });
    });
  };

  /**
   * Handle adding a media item from library to timeline
   */
  const handleAddToTimeline = async (item: MediaItem) => {
    try {
      // Get video metadata (might be cached in item, but we need the full metadata for clip)
      const videoMetadata = await window.electronAPI.getVideoMetadata(
        item.filePath,
      );

      // Create new clip at end of timeline
      const newClip = createClip(
        item.filePath,
        videoMetadata,
        projectState.totalDuration,
      );

      // Mark thumbnails as loading
      newClip.thumbnailsLoading = true;

      const updatedClips = addClip(projectState.clips, newClip);
      const newTotalDuration = calculateTotalDuration(updatedClips);

      // Update project state
      setProjectState({
        ...projectState,
        clips: updatedClips,
        totalDuration: newTotalDuration,
        selectedClipId: newClip.id,
      });

      // Generate thumbnails asynchronously (don't block UI)
      console.log("🎬 Starting thumbnail generation for clip:", newClip.id, {
        filePath: item.filePath,
        sourceStart: newClip.sourceStart,
        sourceEnd: newClip.sourceEnd,
      });

      window.electronAPI
        .generateClipThumbnails(
          item.filePath,
          newClip.id,
          newClip.sourceStart,
          newClip.sourceEnd,
          5.0, // 1 frame every 5 seconds
        )
        .then((thumbnails) => {
          console.log("✅ Thumbnails generated:", thumbnails.length, "frames");
          console.log("📸 Thumbnail paths:", thumbnails);

          // Update clip with generated thumbnails
          setProjectState((prev) => ({
            ...prev,
            clips: prev.clips.map((clip) =>
              clip.id === newClip.id
                ? { ...clip, thumbnails, thumbnailsLoading: false }
                : clip,
            ),
          }));
        })
        .catch((err) => {
          console.error("❌ Failed to generate thumbnails:", err);
          // Clear loading state even on error
          setProjectState((prev) => ({
            ...prev,
            clips: prev.clips.map((clip) =>
              clip.id === newClip.id
                ? { ...clip, thumbnailsLoading: false }
                : clip,
            ),
          }));
        });
    } catch (err) {
      console.error("Failed to add to timeline:", err);
      setError(
        err instanceof Error ? err.message : "Failed to add to timeline",
      );
    }
  };

  /**
   * Handle removing an item from the media library
   * Removes the reference from the library but keeps the original file on disk
   */
  const handleRemoveFromLibrary = async (id: string) => {
    const item = mediaLibrary.find((item) => item.id === id);
    if (!item) {
      console.error("Item not found in library:", id);
      return;
    }

    try {
      // Remove from library (keep the actual file on disk)
      setMediaLibrary((prev) => prev.filter((item) => item.id !== id));

      // Also remove any clips using this file from the timeline
      const updatedClips = projectState.clips.filter(
        (clip) => clip.sourceFilePath !== item.filePath,
      );
      const newTotalDuration = calculateTotalDuration(updatedClips);

      setProjectState((prev) => ({
        ...prev,
        clips: updatedClips,
        totalDuration: newTotalDuration,
        selectedClipId:
          prev.selectedClipId &&
          updatedClips.some((c) => c.id === prev.selectedClipId)
            ? prev.selectedClipId
            : null,
      }));

      // Clean up thumbnails for this video file (now that it's removed from library)
      window.electronAPI.cleanupClipThumbnails(item.filePath).catch((err) => {
        console.error("Failed to cleanup thumbnails:", err);
      });
    } catch (err) {
      console.error("Failed to remove from library:", err);
      setError(
        err instanceof Error ? err.message : "Failed to remove from library",
      );
    }
  };

  /**
   * Handle opening system settings for screen recording permissions
   */
  const handleOpenSettings = async () => {
    try {
      await window.electronAPI.openSystemSettings();
    } catch (err) {
      console.error("Failed to open system settings:", err);
    }
  };

  /**
   * Handle recording mode change
   */
  const handleModeChange = (mode: "screen" | "webcam") => {
    setRecordingState((prev) => ({
      ...prev,
      mode: mode,
    }));
  };

  /**
   * Handle start recording - delegates to screen, webcam, or both based on mode
   */
  const handleStartPicking = async () => {
    if (recordingState.mode === "screen") {
      await handleStartScreenRecording();
    } else if (recordingState.mode === "webcam") {
      await handleStartWebcamRecording();
    } else {
      await handleStartBothRecording();
    }
  };

  /**
   * Handle start screen recording
   */
  const handleStartScreenRecording = async () => {
    setRecordingState((prev) => ({
      ...prev,
      isPicking: true,
      isRecording: false,
    }));
    setRecordingError(null);

    try {
      // Get available displays
      const displays = await window.electronAPI.getAVFoundationDisplays();

      if (displays.length === 0) {
        throw new Error("No displays available for recording");
      }

      // Use the first display (main screen)
      const displayId = displays[0].id;

      // Generate output filename with timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/:/g, "-")
        .replace(/\..+/, "");
      const filename = `recording_${timestamp}.mov`;

      // Start screencapture recording - returns .mov path
      const outputPath = await window.electronAPI.startFFmpegRecording(
        displayId,
        filename,
      );
      recordingOutputPathRef.current = outputPath;

      setRecordingState((prev) => ({
        ...prev,
        isRecording: true,
        isPicking: false,
        startTime: Date.now(),
        elapsedTime: 0,
      }));
    } catch (err) {
      console.error("[screencapture] Failed to start recording:", err);

      let errorMessage = "Unable to start screen recording.";

      if (err instanceof Error) {
        if (
          err.message.includes("permission") ||
          err.message.includes("denied")
        ) {
          errorMessage = `Screen recording permission required.

Please ensure:
1. System Settings > Privacy & Security > Screen Recording
2. Enable permission for this app
3. Completely quit and restart this app

You can click "Open Settings" below to go directly to the settings page.`;
        } else {
          errorMessage = `Error: ${err.message}`;
        }
      }

      setRecordingError(errorMessage);
      setRecordingState((prev) => ({
        ...prev,
        isPicking: false,
        isRecording: false,
      }));
    }
  };

  /**
   * Handle start webcam recording
   */
  const handleStartWebcamRecording = async () => {
    setRecordingState((prev) => ({
      ...prev,
      isPicking: true,
      isRecording: false,
    }));
    setRecordingError(null);

    try {
      // Check camera permission
      const permissionStatus = await window.electronAPI.checkCameraPermission();

      if (!permissionStatus.granted) {
        // Request permission
        const result = await window.electronAPI.requestCameraPermission();
        if (!result.granted) {
          throw new Error("Camera permission denied");
        }
      }

      // Get webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      webcamStreamRef.current = stream;
      recordedChunksRef.current = [];

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8,opus",
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second

      setRecordingState((prev) => ({
        ...prev,
        isRecording: true,
        isPicking: false,
        startTime: Date.now(),
        elapsedTime: 0,
      }));
    } catch (err) {
      console.error("[webcam] Failed to start recording:", err);

      let errorMessage = "Unable to start webcam recording.";

      if (err instanceof Error) {
        if (err.message.includes("permission") || err.message.includes("denied")) {
          errorMessage = `Camera permission required.

Please ensure:
1. System Settings > Privacy & Security > Camera
2. Enable permission for this app
3. Completely quit and restart this app

You can click "Open Settings" below to go directly to the settings page.`;
        } else {
          errorMessage = `Error: ${err.message}`;
        }
      }

      setRecordingError(errorMessage);
      setRecordingState((prev) => ({
        ...prev,
        isPicking: false,
        isRecording: false,
      }));
    }
  };

  /**
   * Handle start both screen + webcam recording
   */
  const handleStartBothRecording = async () => {
    setRecordingState((prev) => ({
      ...prev,
      isPicking: true,
      isRecording: false,
    }));
    setRecordingError(null);

    try {
      // Check camera permission first
      const permissionStatus = await window.electronAPI.checkCameraPermission();

      if (!permissionStatus.granted) {
        const result = await window.electronAPI.requestCameraPermission();
        if (!result.granted) {
          throw new Error("Camera permission denied");
        }
      }

      // STEP 1: Set up webcam stream (but don't start recording yet)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false, // Screen recording will capture audio
      });

      webcamStreamRef.current = stream;
      recordedChunksRef.current = [];

      // Create MediaRecorder - use VP9 for better quality and more reliable timestamps
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 2500000, // 2.5 Mbps for smooth video
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      // STEP 2: Set up screen recording (but don't start yet)
      const displays = await window.electronAPI.getAVFoundationDisplays();

      if (displays.length === 0) {
        throw new Error("No displays available for recording");
      }

      const displayId = displays[0].id;
      const timestamp = new Date()
        .toISOString()
        .replace(/:/g, "-")
        .replace(/\..+/, "");
      const filename = `recording_${timestamp}.mov`;

      // STEP 3: Start BOTH recordings with precise timestamp tracking
      console.log("[sync] 🎬 Starting synchronized recording...");
      console.log("[sync] 🧪 DIAGNOSTIC MODE: Let's figure out which recording actually starts first");

      // Mark when we initiate screen recording (before IPC call)
      const screenRequestTime = performance.now();
      console.log(`[sync] ⏱️  Screen recording IPC sent at: ${screenRequestTime.toFixed(3)}ms`);

      // Start screen recording first (it's slower to start)
      const screenRecordingPromise = window.electronAPI.startFFmpegRecording(
        displayId,
        filename,
      );

      // Mark when we start webcam recording
      const webcamStartTime = performance.now();
      console.log(`[sync] 📹 Webcam MediaRecorder.start() called at: ${webcamStartTime.toFixed(3)}ms`);
      mediaRecorder.start(1000);

      // Wait for screen recording to confirm it started
      const outputPath = await screenRecordingPromise;
      const screenConfirmTime = performance.now();
      console.log(`[sync] ✅ Screen recording IPC confirmed at: ${screenConfirmTime.toFixed(3)}ms`);

      // Calculate the offset
      const offsetMs = screenConfirmTime - webcamStartTime;
      const offsetSeconds = offsetMs / 1000;

      console.log(`[sync] 🔄 Raw offset calculation: ${offsetMs.toFixed(3)}ms (${offsetSeconds.toFixed(3)}s)`);
      console.log(`[sync] 📊 Timing breakdown:
  - Screen IPC request: ${screenRequestTime.toFixed(3)}ms
  - Webcam start call:  ${webcamStartTime.toFixed(3)}ms
  - Screen IPC confirm: ${screenConfirmTime.toFixed(3)}ms
  - IPC latency:        ${(webcamStartTime - screenRequestTime).toFixed(3)}ms
  - Confirmation delay: ${(screenConfirmTime - webcamStartTime).toFixed(3)}ms`);

      console.log(`[sync] 🤔 ANALYSIS:`);
      console.log(`[sync]    - Webcam MediaRecorder.start() was called ${offsetMs.toFixed(3)}ms BEFORE screen IPC confirmed`);
      console.log(`[sync]    - BUT: IPC confirmation ≠ actual recording start time!`);
      console.log(`[sync]    - Screen recording might have ALREADY been capturing frames before IPC returned`);
      console.log(`[sync]    - MediaRecorder has ~100-500ms internal buffer/startup time`);
      console.log(`[sync]    - If webcam appears DELAYED, it means screen captured frames BEFORE webcam did`);
      console.log(`[sync] `);
      console.log(`[sync] 💡 CURRENT STRATEGY: Trimming ${offsetSeconds.toFixed(3)}s from WEBCAM start`);
      console.log(`[sync]    This assumes webcam started recording first.`);
      console.log(`[sync]    If webcam appears delayed in result, we need to REVERSE this!`);

      // Store the offset for later use when combining videos
      (recordingOutputPathRef as any).offsetSeconds = offsetSeconds;

      recordingOutputPathRef.current = outputPath;

      setRecordingState((prev) => ({
        ...prev,
        isRecording: true,
        isPicking: false,
        startTime: Date.now(),
        elapsedTime: 0,
      }));
    } catch (err) {
      console.error("[both] Failed to start recording:", err);

      // Cleanup webcam if started
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((track) => track.stop());
        webcamStreamRef.current = null;
      }

      let errorMessage = "Unable to start recording.";

      if (err instanceof Error) {
        if (err.message.includes("permission") || err.message.includes("denied")) {
          errorMessage = `Permission required for camera and/or screen recording.

Please ensure:
1. System Settings > Privacy & Security > Camera
2. System Settings > Privacy & Security > Screen Recording
3. Enable permissions for this app
4. Completely quit and restart this app

You can click "Open Settings" below to go directly to the settings page.`;
        } else {
          errorMessage = `Error: ${err.message}`;
        }
      }

      setRecordingError(errorMessage);
      setRecordingState((prev) => ({
        ...prev,
        isPicking: false,
        isRecording: false,
      }));
    }
  };

  /**
   * Handle stop recording - delegates based on mode
   */
  const handleStopRecording = async () => {
    if (recordingState.mode === "screen") {
      await handleStopScreenRecording();
    } else if (recordingState.mode === "webcam") {
      await handleStopWebcamRecording();
    } else {
      await handleStopBothRecording();
    }
  };

  /**
   * Handle stop screen recording
   */
  const handleStopScreenRecording = async () => {
    try {
      // Set to "saving" state
      setRecordingState((prev) => ({
        ...prev,
        isRecording: false,
        isSaving: true,
      }));

      // Stop screencapture recording
      await window.electronAPI.stopFFmpegRecording();

      // Import the recorded MP4 file
      await handleRecordingStopped();
    } catch (err) {
      console.error("[screencapture] Failed to stop recording:", err);
      setRecordingError(
        err instanceof Error ? err.message : "Failed to stop recording",
      );
      setRecordingState((prev) => ({
        ...prev,
        isSaving: false,
      }));
    }
  };

  /**
   * Handle stop webcam recording
   */
  const handleStopWebcamRecording = async () => {
    try {
      // Set to "saving" state
      setRecordingState((prev) => ({
        ...prev,
        isRecording: false,
        isSaving: true,
      }));

      // Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();

        // Wait for final data
        await new Promise<void>((resolve) => {
          mediaRecorderRef.current!.onstop = () => resolve();
        });
      }

      // Stop webcam stream
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((track) => track.stop());
        webcamStreamRef.current = null;
      }

      // Create blob from recorded chunks
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });

      // Generate filename
      const timestamp = new Date()
        .toISOString()
        .replace(/:/g, "-")
        .replace(/\..+/, "");
      const filename = `webcam_${timestamp}.webm`;

      // Convert blob to ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();

      // Save recording
      const webmPath = await window.electronAPI.saveRecording(arrayBuffer, filename);
      console.log("[webcam] Saved recording:", webmPath);

      // Convert to MOV for consistency
      const movPath = await window.electronAPI.convertWebmToMov(webmPath);
      console.log("[webcam] Converted to MOV:", movPath);

      recordingOutputPathRef.current = movPath;

      // Import to library
      await handleRecordingStopped();

      // Cleanup
      recordedChunksRef.current = [];
    } catch (err) {
      console.error("[webcam] Failed to stop recording:", err);
      setRecordingError(
        err instanceof Error ? err.message : "Failed to stop recording",
      );
      setRecordingState((prev) => ({
        ...prev,
        isSaving: false,
      }));
    }
  };

  /**
   * Handle stop both screen + webcam recording
   */
  const handleStopBothRecording = async () => {
    try {
      // Set to "saving" state
      setRecordingState((prev) => ({
        ...prev,
        isRecording: false,
        isSaving: true,
      }));

      console.log("[sync] 🛑 Stopping both recordings...");

      // Stop screen recording first
      const stopScreenTime = performance.now();
      await window.electronAPI.stopFFmpegRecording();
      console.log(`[sync] ✅ Screen recording stopped at: ${stopScreenTime.toFixed(3)}ms`);

      // Stop webcam recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        const stopWebcamTime = performance.now();
        mediaRecorderRef.current.stop();

        // Wait for final data
        await new Promise<void>((resolve) => {
          mediaRecorderRef.current!.onstop = () => resolve();
        });
        console.log(`[sync] ✅ Webcam recording stopped at: ${stopWebcamTime.toFixed(3)}ms`);
      }

      // Stop webcam stream
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((track) => track.stop());
        webcamStreamRef.current = null;
      }

      // Create blob from webcam chunks
      const webcamBlob = new Blob(recordedChunksRef.current, { type: "video/webm" });

      // Generate filenames
      const timestamp = new Date()
        .toISOString()
        .replace(/:/g, "-")
        .replace(/\..+/, "");
      const webcamFilename = `webcam_temp_${timestamp}.webm`;

      // Save webcam recording to temp file
      const webcamArrayBuffer = await webcamBlob.arrayBuffer();
      const webcamPath = await window.electronAPI.saveRecording(webcamArrayBuffer, webcamFilename);
      console.log("[sync] 💾 Saved webcam to:", webcamPath);

      // Wait for screen recording to finalize (same as handleRecordingStopped)
      console.log("[sync] ⏳ Waiting for screen recording to finalize...");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const screenPath = recordingOutputPathRef.current;
      if (!screenPath) {
        throw new Error("Screen recording path not set");
      }

      console.log("[sync] 📂 Files ready for overlay:");
      console.log(`[sync]   - Screen: ${screenPath}`);
      console.log(`[sync]   - Webcam: ${webcamPath}`);
      console.log(`[sync] ✅ Using simple overlay - no timing adjustments`);

      // Use FFmpeg to overlay webcam on screen (PiP in bottom-right)
      // NO OFFSET - let FFmpeg handle it naturally
      const combinedPath = await window.electronAPI.overlayWebcamOnScreen(
        screenPath,
        webcamPath,
        0, // No offset
      );

      console.log("[sync] ✅ Combined recording created:", combinedPath);

      // Set combined path as the output
      recordingOutputPathRef.current = combinedPath;

      // Import to library
      await handleRecordingStopped();

      // Cleanup
      recordedChunksRef.current = [];

      console.log("[sync] 🎉 Recording successfully saved and imported!");
    } catch (err) {
      console.error("[both] Failed to stop recording:", err);
      setRecordingError(
        err instanceof Error ? err.message : "Failed to stop recording",
      );
      setRecordingState((prev) => ({
        ...prev,
        isSaving: false,
      }));
    }
  };

  /**
   * Handle recording stopped - import MOV file
   */
  const handleRecordingStopped = async () => {
    try {
      // Get the output path from ref (this will be a .mov file from screencapture)
      const filePath = recordingOutputPathRef.current;

      if (!filePath) {
        throw new Error("Recording output path not set");
      }

      // Calculate final elapsed time from ref (for fallback if needed)
      const finalElapsedTime = recordingStartTimeRef.current
        ? (Date.now() - recordingStartTimeRef.current) / 1000
        : elapsedTimeRef.current;

      // Wait for screencapture to fully finalize the file
      // screencapture writes the file when it stops, but needs time to flush/finalize
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verify the MOV file is accessible and has content
      try {
        const fileSize = await window.electronAPI.getFileSize(filePath);
        if (fileSize === 0) {
          throw new Error("Video file is empty");
        }
      } catch (err) {
        console.error("[screencapture] File verification failed:", err);
        throw new Error("Video file not ready or is empty");
      }

      // Import the recorded MOV video directly (no conversion needed)
      // Fetch video metadata
      const videoMetadata = await window.electronAPI.getVideoMetadata(filePath);

      // Use metadata duration or fallback to elapsed time
      const actualDuration =
        videoMetadata.duration > 0 ? videoMetadata.duration : finalElapsedTime;

      // Update metadata with correct duration (if needed)
      const correctedMetadata: VideoMetadata = {
        ...videoMetadata,
        duration: actualDuration,
      };

      // Generate thumbnail
      const thumbnail = await window.electronAPI.generateThumbnail(filePath);

      // Get file size
      const fileSize = await window.electronAPI.getFileSize(filePath);

      // Create media item
      const fileName = filePath.split("/").pop() || "Unknown";
      const resolution = `${videoMetadata.width}x${videoMetadata.height}`;
      const newMediaItem: MediaItem = {
        id: crypto.randomUUID(),
        filePath: filePath,
        fileName,
        thumbnail,
        duration: correctedMetadata.duration,
        resolution,
        fileSize,
        addedAt: Date.now(),
      };

      // Add to media library only (not to timeline)
      setMediaLibrary((prev) => [...prev, newMediaItem]);

      // Reset recording state (keep the mode for next recording)
      setRecordingState((prev) => ({
        isRecording: false,
        isPicking: false,
        isSaving: false,
        selectedSource: null,
        startTime: null,
        elapsedTime: 0,
        mode: prev.mode, // Keep the current mode
      }));

      // Clear refs
      recordingStartTimeRef.current = null;
      elapsedTimeRef.current = 0;
      recordingOutputPathRef.current = null;
    } catch (err) {
      console.error("Failed to save recording:", err);
      setRecordingError(
        err instanceof Error ? err.message : "Failed to save recording",
      );
    }
  };

  const selectedClip = projectState.selectedClipId
    ? projectState.clips.find((c) => c.id === projectState.selectedClipId) ||
      null
    : null;

  // Get the current clip being played at the current timeline time
  const currentClip = getClipAtTime(
    projectState.clips,
    projectState.currentTime,
  );

  // Get the clip to display in the video player (scrub clip takes priority during scrubbing)
  const displayClip = scrubClipId
    ? projectState.clips.find(c => c.id === scrubClipId) || currentClip
    : currentClip;

  // Calculate the source video time within the current clip
  const getSourceTimeForClip = (
    clip: Clip | null,
    timelineTime: number,
  ): number => {
    if (!clip) return 0;
    // Convert timeline time to source video time
    const offsetIntoClip = timelineTime - clip.timelineStart;
    return clip.sourceStart + offsetIntoClip;
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    videoPlayerRef,
    isPlaying: projectState.isPlaying,
    hasClips: projectState.clips.length > 0,
    selectedClipId: projectState.selectedClipId,
    currentTime: projectState.currentTime,
    onDeleteClip: handleClipDelete,
    onSplitClip: handleSplitClip,
  });

  return (
    <div className="flex flex-col h-screen bg-background text-white overflow-hidden">
      {/* Main Content Area: 3-Panel Grid (50%) + Timeline (50%) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top 50%: 3-Panel Grid */}
        <div className="h-1/2 grid grid-cols-3 border-b border-border">
          {/* Left Panel: Media Library */}
          <div className="border-r border-border overflow-hidden">
            <MediaLibrary
              items={mediaLibrary}
              onAddToTimeline={handleAddToTimeline}
              onRemove={handleRemoveFromLibrary}
              onDrop={handleFileDrop}
              onImport={handleImport}
              isRecording={recordingState.isRecording}
              isPicking={recordingState.isPicking}
              isSaving={recordingState.isSaving}
              elapsedTime={recordingState.elapsedTime}
              onStartPicking={handleStartPicking}
              onStopRecording={handleStopRecording}
              recordingError={recordingError}
              onOpenSettings={handleOpenSettings}
              recordingMode={recordingState.mode}
              onModeChange={handleModeChange}
            />
          </div>

          {/* Center Panel: Video Player */}
          <div className="border-r border-border overflow-hidden flex flex-col items-center justify-center bg-panel p-4">
            {error && (
              <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-900/20 border border-red-500 rounded-lg text-sm text-red-400">
                <span className="text-lg">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {projectState.clips.length > 0 && displayClip ? (
              <VideoPlayer
                ref={videoPlayerRef}
                videoPath={displayClip.sourceFilePath}
                clipId={displayClip.id}
                currentTime={getSourceTimeForClip(
                  displayClip,
                  scrubDisplayTime ?? projectState.currentTime,
                )}
                displayTime={scrubDisplayTime ?? projectState.currentTime}
                trimStart={displayClip.sourceStart}
                trimEnd={displayClip.sourceEnd}
                totalDuration={projectState.totalDuration}
                isPlaying={projectState.isPlaying}
                onTimeUpdate={handleTimeUpdate}
                onPlayPause={handlePlayPause}
              />
            ) : (
              <div className="text-center text-gray-500">
                <p className="text-lg mb-2">No video loaded</p>
                <p className="text-sm">
                  Import a video or record your screen to get started
                </p>
              </div>
            )}
          </div>

          {/* Right Panel: Video Info */}
          <div className="overflow-hidden">
            <VideoInfoPanel
              selectedClip={selectedClip}
              totalClips={projectState.clips.length}
              totalDuration={projectState.totalDuration}
              currentTime={projectState.currentTime}
              clips={projectState.clips}
              onExportComplete={(outputPath) => {
                console.log("Export completed:", outputPath);
              }}
            />
          </div>
        </div>

        {/* Bottom 50%: Timeline */}
        <div className="h-1/2 flex flex-col bg-panel overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-bold tracking-wide">Timeline</h3>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <Timeline
              clips={projectState.clips}
              selectedClipId={projectState.selectedClipId}
              currentTime={projectState.currentTime}
              totalDuration={Math.max(projectState.totalDuration, 60)}
              onClipSelect={handleClipSelect}
              onClipMove={handleClipMove}
              onClipReorder={handleClipReorder}
              onClipTrim={handleClipTrim}
              onSeek={handleSeek}
              onScrub={handleScrub}
              onScrubEnd={handleScrubEnd}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
