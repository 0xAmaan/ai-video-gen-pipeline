/**
 * Beat Analysis - Replicate API Integration
 *
 * This module integrates with Replicate's music analysis model to detect beats,
 * downbeats, and BPM in audio files.
 *
 * CRITICAL: Replicate returns file outputs as ReadableStream objects, not direct JSON.
 * The parseReplicateOutput function handles three response formats:
 * 1. ReadableStream (most common) - Convert to blob → text → JSON
 * 2. URL string (fallback) - Fetch and parse JSON
 * 3. Direct object (edge case) - Use as-is
 *
 * See convex/BEAT_ANALYSIS_DOCS.md for comprehensive documentation.
 *
 * @module beatAnalysis
 */

import { mutation, query, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import Replicate from "replicate";

// Type definitions for Replicate API response
interface ReplicateAnalysisOutput {
  beats?: number[] | string; // Array of beat times in seconds or URL
  downbeats?: number[] | string; // Array of downbeat times in seconds or URL
  bpm?: number | string; // BPM value or URL
  [key: string]: any; // Allow additional fields from the API
}

// BeatMarker type matching the schema validator
interface BeatMarker {
  time: number;
  strength?: number;
  isDownbeat?: boolean;
}

// Replicate model configuration
const REPLICATE_MODEL = "cwalo/all-in-one-music-structure-analysis:6deeba047db17da69e9826c0285cd137cd2a81af05eb44ff496b7acd69b3a383";
const REPLICATE_MODEL_INPUTS = {
  model: "harmonix-all",
  visualize: false,
  sonify: false,
};

/**
 * Parse Replicate API output and extract beat data
 *
 * @param output - Raw output from Replicate API
 * @returns Parsed beat data with markers and BPM
 */
async function parseReplicateOutput(
  output: unknown,
  apiToken: string
): Promise<{
  beatMarkers: BeatMarker[];
  bpm: number | undefined;
}> {
  console.log("[parseReplicateOutput] Parsing Replicate output...");
  console.log("[parseReplicateOutput] Output type:", typeof output);

  // Default return value
  const result = {
    beatMarkers: [] as BeatMarker[],
    bpm: undefined as number | undefined,
  };

  if (!output || typeof output !== "object") {
    console.warn("[parseReplicateOutput] Invalid output format:", typeof output);
    return result;
  }

  // Log output keys for debugging
  try {
    const keys = Object.keys(output);
    console.log("[parseReplicateOutput] Output top-level keys:", keys);
  } catch (e) {
    console.warn("[parseReplicateOutput] Could not extract keys from output");
  }

  // Replicate often returns an array with a single element containing the results
  let data: ReplicateAnalysisOutput | undefined;
  const outputArray = output as any;

  if (outputArray['0']) {
    const firstElement = outputArray['0'];
    console.log("[parseReplicateOutput] Found element at index 0, type:", typeof firstElement);

    // Check if it's a ReadableStream (has _reader, _state properties)
    if (firstElement && typeof firstElement === 'object' && '_reader' in firstElement) {
      console.log("[parseReplicateOutput] Output is a ReadableStream, converting to JSON");
      try {
        const blob = await new Response(firstElement).blob();
        const text = await blob.text();
        console.log("[parseReplicateOutput] Stream text length:", text.length);
        data = JSON.parse(text);
        console.log("[parseReplicateOutput] Parsed stream data keys:", Object.keys(data || {}));
      } catch (e) {
        console.error("[parseReplicateOutput] Failed to parse ReadableStream:", e);
        return result;
      }
    } else if (typeof firstElement === 'string' && firstElement.startsWith('http')) {
      // Output is an array with URL to JSON results file
      console.log("[parseReplicateOutput] Fetching results from URL:", firstElement);
      try {
        const response = await fetch(firstElement, {
          headers: {
            Authorization: `Token ${apiToken}`,
          },
        });
        data = await response.json();
        console.log("[parseReplicateOutput] Fetched data keys:", Object.keys(data || {}));
      } catch (e) {
        console.error("[parseReplicateOutput] Failed to fetch from URL:", e);
        return result;
      }
    } else if (typeof firstElement === 'object') {
      // Output is an array with the results object directly
      console.log("[parseReplicateOutput] Using first array element as data");
      data = firstElement as ReplicateAnalysisOutput;
      console.log("[parseReplicateOutput] Data keys:", Object.keys(data || {}));
    } else {
      console.log("[parseReplicateOutput] First element is unexpected type:", typeof firstElement);
      data = output as ReplicateAnalysisOutput;
    }
  } else {
    console.log("[parseReplicateOutput] No element at index 0, using output directly");
    data = output as ReplicateAnalysisOutput;
    console.log("[parseReplicateOutput] Direct output keys:", Object.keys(data || {}));
  }

  // Safety check - ensure data is defined
  if (!data || typeof data !== 'object') {
    console.error("[parseReplicateOutput] Data is undefined or not an object after parsing");
    return result;
  }

  // Helper function to fetch JSON from URL if needed
  async function getDataFromUrlOrDirect(value: any): Promise<any> {
    if (typeof value === 'string' && value.startsWith('http')) {
      console.log(`[parseReplicateOutput] Fetching data from URL: ${value}`);
      try {
        const response = await fetch(value, {
          headers: {
            Authorization: `Token ${apiToken}`,
          },
        });
        return await response.json();
      } catch (e) {
        console.error(`[parseReplicateOutput] Failed to fetch from URL:`, e);
        return undefined;
      }
    }
    return value;
  }

  // Log what fields are available in data
  console.log("[parseReplicateOutput] Available data fields:", {
    hasBpm: 'bpm' in data,
    hasBeats: 'beats' in data,
    hasDownbeats: 'downbeats' in data,
    bpmType: typeof data.bpm,
    beatsType: typeof data.beats,
    downbeatsType: typeof data.downbeats,
  });

  // Extract BPM (may be URL or direct value)
  const bpmData = await getDataFromUrlOrDirect(data.bpm);
  if (typeof bpmData === "number") {
    result.bpm = bpmData;
  } else if (typeof bpmData === "string") {
    const bpmNum = parseFloat(bpmData);
    if (!isNaN(bpmNum)) {
      result.bpm = bpmNum;
    }
  }

  console.log(`[parseReplicateOutput] Extracted BPM: ${result.bpm}`);

  // Extract beats array (may be URL or direct array)
  let beats: number[] = [];
  if (data.beats !== undefined) {
    const beatsData = await getDataFromUrlOrDirect(data.beats);
    if (Array.isArray(beatsData)) {
      beats = beatsData.filter((b) => typeof b === "number");
    } else {
      console.warn("[parseReplicateOutput] beats data is not an array:", typeof beatsData);
    }
  } else {
    console.warn("[parseReplicateOutput] No beats field in data");
  }

  // Extract downbeats array (may be URL or direct array)
  let downbeats: number[] = [];
  if (data.downbeats !== undefined) {
    const downbeatsData = await getDataFromUrlOrDirect(data.downbeats);
    if (Array.isArray(downbeatsData)) {
      downbeats = downbeatsData.filter((d) => typeof d === "number");
    } else {
      console.warn("[parseReplicateOutput] downbeats data is not an array:", typeof downbeatsData);
    }
  } else {
    console.warn("[parseReplicateOutput] No downbeats field in data");
  }

  console.log(`[parseReplicateOutput] Extracted ${beats.length} beats, ${downbeats.length} downbeats`);
  
  // Debug: Log detailed information if no beats were found
  if (beats.length === 0 && downbeats.length === 0) {
    console.error("[parseReplicateOutput] ⚠️ DEBUGGING: No beats or downbeats extracted!");
    console.error("[parseReplicateOutput] data object:", JSON.stringify(data, null, 2).substring(0, 500));
    console.error("[parseReplicateOutput] data.beats:", data.beats);
    console.error("[parseReplicateOutput] data.downbeats:", data.downbeats);
    console.error("[parseReplicateOutput] data.bpm:", data.bpm);
  } else {
    console.log("[parseReplicateOutput] Sample beats:", beats.slice(0, 5));
    console.log("[parseReplicateOutput] Sample downbeats:", downbeats.slice(0, 5));
  }

  // Create a Set for quick lookup of downbeat times
  const downbeatSet = new Set(downbeats);

  // Combine beats and downbeats into BeatMarker array
  const allTimes = new Set([...beats, ...downbeats]);
  const beatMarkers: BeatMarker[] = Array.from(allTimes)
    .sort((a, b) => a - b)
    .map((time) => {
      const isDownbeat = downbeatSet.has(time);
      return {
        time,
        isDownbeat,
        strength: isDownbeat ? 1.0 : 0.8, // Downbeats are stronger
      };
    });

  result.beatMarkers = beatMarkers;

  console.log(`[parseReplicateOutput] Created ${beatMarkers.length} beat markers`);

  return result;
}

/**
 * Public mutation to trigger beat analysis for an audio asset
 *
 * @param assetId - The ID of the audio asset to analyze
 * @returns void - Schedules the analysis action
 */
export const analyzeBeatsMutation = mutation({
  args: {
    assetId: v.id("audioAssets"),
  },
  handler: async (ctx, args) => {
    const { assetId } = args;

    console.log(`[analyzeBeatsMutation] Triggering analysis for asset ${assetId}`);

    // Validate that the asset exists
    const asset = await ctx.db.get(assetId);
    if (!asset) {
      console.error(`[analyzeBeatsMutation] Asset ${assetId} not found`);
      throw new Error(`Audio asset ${assetId} not found`);
    }

    // Validate that the asset has a URL
    if (!asset.url) {
      console.error(`[analyzeBeatsMutation] Asset ${assetId} has no URL`);
      throw new Error(`Audio asset ${assetId} has no URL for analysis`);
    }

    // Check if analysis is already in progress
    if (asset.beatAnalysisStatus === "analyzing") {
      console.warn(`[analyzeBeatsMutation] Analysis already in progress for asset ${assetId}`);
      throw new Error(`Beat analysis is already in progress for this asset`);
    }

    // Update status to analyzing
    await ctx.db.patch(assetId, {
      beatAnalysisStatus: "analyzing",
      analysisError: undefined, // Clear any previous errors
      updatedAt: Date.now(),
    });

    console.log(`[analyzeBeatsMutation] Status updated to analyzing, scheduling action`);

    // Schedule the analysis action immediately
    await ctx.scheduler.runAfter(0, internal.beatAnalysis.performAnalysis, {
      assetId,
      audioUrl: asset.url,
    });

    console.log(`[analyzeBeatsMutation] Analysis action scheduled for asset ${assetId}`);
  },
});

/**
 * Query to get beat analysis status for an audio asset
 *
 * @param assetId - The ID of the audio asset
 * @returns Analysis status information
 */
export const getAnalysisStatus = query({
  args: {
    assetId: v.id("audioAssets"),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);

    if (!asset) {
      return null;
    }

    return {
      status: asset.beatAnalysisStatus,
      error: asset.analysisError,
      bpm: asset.bpm,
      beatCount: asset.beatMarkers?.length ?? 0,
      analysisMethod: asset.analysisMethod,
      hasMarkers: (asset.beatMarkers?.length ?? 0) > 0,
    };
  },
});

/**
 * Internal action to perform beat analysis using Replicate API
 *
 * @param assetId - The ID of the audio asset to analyze
 * @param audioUrl - The publicly accessible URL of the audio file
 * @returns void - Results are saved via internal mutations
 */
export const performAnalysis = internalAction({
  args: {
    assetId: v.id("audioAssets"),
    audioUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const { assetId, audioUrl } = args;

    // Validate environment variable
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      console.error("[performAnalysis] REPLICATE_API_TOKEN not configured");
      await ctx.runMutation(internal.beatAnalysis.markAnalysisFailed, {
        assetId,
        error: "REPLICATE_API_TOKEN not configured in environment",
      });
      return;
    }

    try {
      console.log(`[performAnalysis] Starting analysis for asset ${assetId}`);
      console.log(`[performAnalysis] Audio URL: ${audioUrl}`);

      // Initialize Replicate client
      const replicate = new Replicate({
        auth: apiToken,
      });

      // Call Replicate API
      const output = await replicate.run(
        REPLICATE_MODEL as `${string}/${string}:${string}`,
        {
          input: {
            music_input: audioUrl,
            ...REPLICATE_MODEL_INPUTS,
          },
        }
      );

      console.log("[performAnalysis] Replicate API call completed");
      console.log("[performAnalysis] Output type:", typeof output);

      // Log output keys (avoiding circular structure)
      if (output && typeof output === 'object') {
        console.log("[performAnalysis] Output keys:", Object.keys(output));

        // Check if output is an array-like object with URL properties
        const outputObj = output as any;

        // If output is array-like and has index 0, it's likely an array with URLs
        if (outputObj['0']) {
          console.log(`[performAnalysis] Output appears to be array-like, first element type: ${typeof outputObj['0']}`);
          if (typeof outputObj['0'] === 'string') {
            console.log(`[performAnalysis] First element: ${outputObj['0']}`);
          }
        }

        // Also check for named properties with URLs
        for (const [key, value] of Object.entries(outputObj)) {
          if (typeof value === 'string' && value.startsWith('http')) {
            console.log(`[performAnalysis] ${key}: ${value}`);
          }
        }
      }

      // Parse the output to extract beat markers and BPM
      const { beatMarkers, bpm } = await parseReplicateOutput(output, apiToken);

      if (beatMarkers.length === 0) {
        console.warn("[performAnalysis] No beat markers extracted from output");
        await ctx.runMutation(internal.beatAnalysis.markAnalysisFailed, {
          assetId,
          error: "No beat data found in analysis output",
        });
        return;
      }

      console.log(`[performAnalysis] Successfully parsed ${beatMarkers.length} beat markers, BPM: ${bpm}`);

      // Save the beat markers to the database
      await ctx.runMutation(internal.beatAnalysis.saveBeatMarkers, {
        assetId,
        beatMarkers,
        bpm,
      });

      console.log("[performAnalysis] Analysis completed successfully");

    } catch (error) {
      console.error("[performAnalysis] Error during analysis:", error);

      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error during beat analysis";

      await ctx.runMutation(internal.beatAnalysis.markAnalysisFailed, {
        assetId,
        error: errorMessage,
      });
    }
  },
});

/**
 * Internal mutation to save beat markers to an audio asset
 *
 * @param assetId - The ID of the audio asset
 * @param beatMarkers - Array of beat markers with timestamps
 * @param bpm - Beats per minute value
 */
export const saveBeatMarkers = internalMutation({
  args: {
    assetId: v.id("audioAssets"),
    beatMarkers: v.array(
      v.object({
        time: v.number(),
        strength: v.optional(v.number()),
        isDownbeat: v.optional(v.boolean()),
      })
    ),
    bpm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { assetId, beatMarkers, bpm } = args;

    console.log(`[saveBeatMarkers] Saving ${beatMarkers.length} beat markers for asset ${assetId}`);

    try {
      await ctx.db.patch(assetId, {
        beatMarkers,
        bpm,
        beatAnalysisStatus: "completed",
        analysisMethod: "replicate",
        analysisError: undefined, // Clear any previous errors
        updatedAt: Date.now(),
      });

      console.log(`[saveBeatMarkers] Successfully saved beat markers`);
    } catch (error) {
      console.error("[saveBeatMarkers] Error saving beat markers:", error);
      throw error;
    }
  },
});

/**
 * Internal mutation to mark beat analysis as failed
 *
 * @param assetId - The ID of the audio asset
 * @param error - Error message describing the failure
 */
export const markAnalysisFailed = internalMutation({
  args: {
    assetId: v.id("audioAssets"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const { assetId, error } = args;

    console.log(`[markAnalysisFailed] Marking analysis as failed for asset ${assetId}`);
    console.log(`[markAnalysisFailed] Error: ${error}`);

    try {
      await ctx.db.patch(assetId, {
        beatAnalysisStatus: "failed",
        analysisError: error,
        updatedAt: Date.now(),
      });

      console.log(`[markAnalysisFailed] Successfully marked as failed`);
    } catch (dbError) {
      console.error("[markAnalysisFailed] Error updating database:", dbError);
      throw dbError;
    }
  },
});

/**
 * Polymorphic mutation to trigger beat analysis for editor assets
 *
 * @param assetId - The ID of the editor asset (video or audio)
 * @returns void - Schedules the analysis action
 */
export const analyzeEditorAssetBeats = mutation({
  args: {
    assetId: v.id("editorAssets"),
  },
  handler: async (ctx, args) => {
    const { assetId } = args;

    console.log(`[analyzeEditorAssetBeats] Triggering analysis for editor asset ${assetId}`);

    // Validate that the asset exists
    const asset = await ctx.db.get(assetId);
    if (!asset) {
      console.error(`[analyzeEditorAssetBeats] Asset ${assetId} not found`);
      throw new Error(`Editor asset ${assetId} not found`);
    }

    // Only analyze audio and video assets
    if (asset.type !== "audio" && asset.type !== "video") {
      console.error(`[analyzeEditorAssetBeats] Asset ${assetId} is type ${asset.type}, not audio/video`);
      throw new Error(`Beat analysis only supports audio and video assets`);
    }

    // Validate that the asset has a URL
    if (!asset.url) {
      console.error(`[analyzeEditorAssetBeats] Asset ${assetId} has no URL`);
      throw new Error(`Editor asset ${assetId} has no URL for analysis`);
    }

    // Check if analysis is already in progress
    if (asset.beatAnalysisStatus === "analyzing") {
      console.warn(`[analyzeEditorAssetBeats] Analysis already in progress for asset ${assetId}`);
      throw new Error(`Beat analysis is already in progress for this asset`);
    }

    // Update status to analyzing
    await ctx.db.patch(assetId, {
      beatAnalysisStatus: "analyzing",
      analysisError: undefined, // Clear any previous errors
      updatedAt: Date.now(),
    });

    console.log(`[analyzeEditorAssetBeats] Status updated to analyzing, scheduling action`);

    // Use proxyUrl if available, otherwise use url
    const mediaUrl = asset.proxyUrl ?? asset.url;

    // Schedule the analysis action immediately
    await ctx.scheduler.runAfter(0, internal.beatAnalysis.performEditorAssetAnalysis, {
      assetId,
      mediaUrl,
    });

    console.log(`[analyzeEditorAssetBeats] Analysis action scheduled for editor asset ${assetId}`);
  },
});

/**
 * Query to get beat analysis status for an editor asset
 *
 * @param assetId - The ID of the editor asset
 * @returns Analysis status information
 */
export const getEditorAssetAnalysisStatus = query({
  args: {
    assetId: v.id("editorAssets"),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);

    if (!asset) {
      return null;
    }

    return {
      status: asset.beatAnalysisStatus,
      error: asset.analysisError,
      bpm: asset.bpm,
      beatCount: asset.beatMarkers?.length ?? 0,
      analysisMethod: asset.analysisMethod,
      hasMarkers: (asset.beatMarkers?.length ?? 0) > 0,
    };
  },
});

/**
 * Internal action to perform beat analysis on an editor asset using Replicate API
 *
 * @param assetId - The ID of the editor asset to analyze
 * @param mediaUrl - The publicly accessible URL of the media file
 * @returns void - Results are saved via internal mutations
 */
export const performEditorAssetAnalysis = internalAction({
  args: {
    assetId: v.id("editorAssets"),
    mediaUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const { assetId, mediaUrl } = args;

    // Validate environment variable
    const apiToken = process.env.REPLICATE_API_KEY;
    if (!apiToken) {
      console.error("[performEditorAssetAnalysis] REPLICATE_API_KEY not configured");
      await ctx.runMutation(internal.beatAnalysis.markEditorAssetAnalysisFailed, {
        assetId,
        error: "REPLICATE_API_TOKEN not configured in environment",
      });
      return;
    }

    try {
      console.log(`[performEditorAssetAnalysis] Starting analysis for editor asset ${assetId}`);
      console.log(`[performEditorAssetAnalysis] Media URL: ${mediaUrl}`);

      // Initialize Replicate client
      const replicate = new Replicate({
        auth: apiToken,
      });

      // Call Replicate API
      const output = await replicate.run(
        REPLICATE_MODEL as `${string}/${string}:${string}`,
        {
          input: {
            music_input: mediaUrl,
            ...REPLICATE_MODEL_INPUTS,
          },
        }
      );

      console.log("[performEditorAssetAnalysis] Replicate API call completed");
      console.log("[performEditorAssetAnalysis] Output type:", typeof output);

      // Parse the output to extract beat markers and BPM
      const { beatMarkers, bpm } = await parseReplicateOutput(output, apiToken);

      if (beatMarkers.length === 0) {
        console.warn("[performEditorAssetAnalysis] No beat markers extracted from output");
        await ctx.runMutation(internal.beatAnalysis.markEditorAssetAnalysisFailed, {
          assetId,
          error: "No beat data found in analysis output",
        });
        return;
      }

      console.log(`[performEditorAssetAnalysis] Successfully parsed ${beatMarkers.length} beat markers, BPM: ${bpm}`);

      // Save the beat markers to the database
      await ctx.runMutation(internal.beatAnalysis.saveEditorAssetBeatMarkers, {
        assetId,
        beatMarkers,
        bpm,
      });

      console.log("[performEditorAssetAnalysis] Analysis completed successfully");

    } catch (error) {
      console.error("[performEditorAssetAnalysis] Error during analysis:", error);

      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error during beat analysis";

      await ctx.runMutation(internal.beatAnalysis.markEditorAssetAnalysisFailed, {
        assetId,
        error: errorMessage,
      });
    }
  },
});

/**
 * Internal mutation to save beat markers to an editor asset
 *
 * @param assetId - The ID of the editor asset
 * @param beatMarkers - Array of beat markers with timestamps
 * @param bpm - Beats per minute value
 */
export const saveEditorAssetBeatMarkers = internalMutation({
  args: {
    assetId: v.id("editorAssets"),
    beatMarkers: v.array(
      v.object({
        time: v.number(),
        strength: v.optional(v.number()),
        isDownbeat: v.optional(v.boolean()),
      })
    ),
    bpm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { assetId, beatMarkers, bpm } = args;

    console.log(`[saveEditorAssetBeatMarkers] Saving ${beatMarkers.length} beat markers for editor asset ${assetId}`);

    try {
      await ctx.db.patch(assetId, {
        beatMarkers,
        bpm,
        beatAnalysisStatus: "completed",
        analysisMethod: "replicate",
        analysisError: undefined, // Clear any previous errors
        updatedAt: Date.now(),
      });

      console.log(`[saveEditorAssetBeatMarkers] Successfully saved beat markers`);
    } catch (error) {
      console.error("[saveEditorAssetBeatMarkers] Error saving beat markers:", error);
      throw error;
    }
  },
});

/**
 * Internal mutation to mark editor asset beat analysis as failed
 *
 * @param assetId - The ID of the editor asset
 * @param error - Error message describing the failure
 */
export const markEditorAssetAnalysisFailed = internalMutation({
  args: {
    assetId: v.id("editorAssets"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const { assetId, error } = args;

    console.log(`[markEditorAssetAnalysisFailed] Marking analysis as failed for editor asset ${assetId}`);
    console.log(`[markEditorAssetAnalysisFailed] Error: ${error}`);

    try {
      await ctx.db.patch(assetId, {
        beatAnalysisStatus: "failed",
        analysisError: error,
        updatedAt: Date.now(),
      });

      console.log(`[markEditorAssetAnalysisFailed] Successfully marked as failed`);
    } catch (dbError) {
      console.error("[markEditorAssetAnalysisFailed] Error updating database:", dbError);
      throw dbError;
    }
  },
});

/**
 * Public mutation to trigger beat analysis for a video clip
 *
 * @param clipId - The ID of the video clip to analyze
 * @returns void - Schedules the analysis action
 */
export const analyzeVideoClipBeats = mutation({
  args: {
    clipId: v.id("videoClips"),
  },
  handler: async (ctx, args) => {
    const { clipId } = args;

    console.log(`[analyzeVideoClipBeats] Triggering analysis for clip ${clipId}`);

    // Validate that the clip exists
    const clip = await ctx.db.get(clipId);
    if (!clip) {
      console.error(`[analyzeVideoClipBeats] Clip ${clipId} not found`);
      throw new Error(`Video clip ${clipId} not found`);
    }

    // Get the video URL (prefer proxy, fallback to regular URL)
    const videoUrl = clip.proxyUrl ?? clip.videoUrl ?? clip.sourceUrl;
    if (!videoUrl) {
      console.error(`[analyzeVideoClipBeats] Clip ${clipId} has no URL`);
      throw new Error(`Video clip ${clipId} has no URL for analysis`);
    }

    // Check if analysis is already in progress
    if (clip.beatAnalysisStatus === "analyzing") {
      console.warn(`[analyzeVideoClipBeats] Analysis already in progress for clip ${clipId}`);
      throw new Error(`Beat analysis is already in progress for this video clip`);
    }

    // Update status to analyzing
    await ctx.db.patch(clipId, {
      beatAnalysisStatus: "analyzing",
      analysisError: undefined, // Clear any previous errors
      updatedAt: Date.now(),
    });

    console.log(`[analyzeVideoClipBeats] Status updated to analyzing, scheduling action`);

    // Schedule the analysis action immediately
    await ctx.scheduler.runAfter(0, internal.beatAnalysis.performVideoAnalysis, {
      clipId,
      videoUrl,
    });

    console.log(`[analyzeVideoClipBeats] Analysis action scheduled for clip ${clipId}`);
  },
});

/**
 * Query to get beat analysis status for a video clip
 *
 * @param clipId - The ID of the video clip
 * @returns Analysis status information
 */
export const getVideoClipAnalysisStatus = query({
  args: {
    clipId: v.id("videoClips"),
  },
  handler: async (ctx, args) => {
    const clip = await ctx.db.get(args.clipId);

    if (!clip) {
      return null;
    }

    return {
      status: clip.beatAnalysisStatus,
      error: clip.analysisError,
      bpm: clip.bpm,
      beatCount: clip.beatMarkers?.length ?? 0,
      analysisMethod: clip.analysisMethod,
      hasMarkers: (clip.beatMarkers?.length ?? 0) > 0,
    };
  },
});

/**
 * Internal action to perform beat analysis on a video clip using Replicate API
 *
 * @param clipId - The ID of the video clip to analyze
 * @param videoUrl - The publicly accessible URL of the video file
 * @returns void - Results are saved via internal mutations
 */
export const performVideoAnalysis = internalAction({
  args: {
    clipId: v.id("videoClips"),
    videoUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const { clipId, videoUrl } = args;

    // Validate environment variable
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      console.error("[performVideoAnalysis] REPLICATE_API_TOKEN not configured");
      await ctx.runMutation(internal.beatAnalysis.markVideoAnalysisFailed, {
        clipId,
        error: "REPLICATE_API_KEY not configured in environment",
      });
      return;
    }

    try {
      console.log(`[performVideoAnalysis] Starting analysis for clip ${clipId}`);
      console.log(`[performVideoAnalysis] Video URL: ${videoUrl}`);

      // Initialize Replicate client
      const replicate = new Replicate({
        auth: apiToken,
      });

      // Call Replicate API with video URL
      // The Replicate model accepts video files and extracts audio automatically
      const output = await replicate.run(
        REPLICATE_MODEL as `${string}/${string}:${string}`,
        {
          input: {
            music_input: videoUrl,
            ...REPLICATE_MODEL_INPUTS,
          },
        }
      );

      console.log("[performVideoAnalysis] Replicate API call completed");
      console.log("[performVideoAnalysis] Output type:", typeof output);

      // Parse the output to extract beat markers and BPM
      const { beatMarkers, bpm } = await parseReplicateOutput(output, apiToken);

      if (beatMarkers.length === 0) {
        console.warn("[performVideoAnalysis] No beat markers extracted from output");
        await ctx.runMutation(internal.beatAnalysis.markVideoAnalysisFailed, {
          clipId,
          error: "No beat data found in analysis output",
        });
        return;
      }

      console.log(`[performVideoAnalysis] Successfully parsed ${beatMarkers.length} beat markers, BPM: ${bpm}`);

      // Save the beat markers to the database
      await ctx.runMutation(internal.beatAnalysis.saveVideoClipBeatMarkers, {
        clipId,
        beatMarkers,
        bpm,
      });

      console.log("[performVideoAnalysis] Analysis completed successfully");

    } catch (error) {
      console.error("[performVideoAnalysis] Error during analysis:", error);

      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error during beat analysis";

      await ctx.runMutation(internal.beatAnalysis.markVideoAnalysisFailed, {
        clipId,
        error: errorMessage,
      });
    }
  },
});

/**
 * Internal mutation to save beat markers to a video clip
 *
 * @param clipId - The ID of the video clip
 * @param beatMarkers - Array of beat markers with timestamps
 * @param bpm - Beats per minute value
 */
export const saveVideoClipBeatMarkers = internalMutation({
  args: {
    clipId: v.id("videoClips"),
    beatMarkers: v.array(
      v.object({
        time: v.number(),
        strength: v.optional(v.number()),
        isDownbeat: v.optional(v.boolean()),
      })
    ),
    bpm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { clipId, beatMarkers, bpm } = args;

    console.log(`[saveVideoClipBeatMarkers] Saving ${beatMarkers.length} beat markers for clip ${clipId}`);

    try {
      await ctx.db.patch(clipId, {
        beatMarkers,
        bpm,
        beatAnalysisStatus: "completed",
        analysisMethod: "replicate",
        analysisError: undefined, // Clear any previous errors
        updatedAt: Date.now(),
      });

      console.log(`[saveVideoClipBeatMarkers] Successfully saved beat markers`);
    } catch (error) {
      console.error("[saveVideoClipBeatMarkers] Error saving beat markers:", error);
      throw error;
    }
  },
});

/**
 * Internal mutation to mark video beat analysis as failed
 *
 * @param clipId - The ID of the video clip
 * @param error - Error message describing the failure
 */
export const markVideoAnalysisFailed = internalMutation({
  args: {
    clipId: v.id("videoClips"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const { clipId, error } = args;

    console.log(`[markVideoAnalysisFailed] Marking analysis as failed for clip ${clipId}`);
    console.log(`[markVideoAnalysisFailed] Error: ${error}`);

    try {
      await ctx.db.patch(clipId, {
        beatAnalysisStatus: "failed",
        analysisError: error,
        updatedAt: Date.now(),
      });

      console.log(`[markVideoAnalysisFailed] Successfully marked as failed`);
    } catch (dbError) {
      console.error("[markVideoAnalysisFailed] Error updating database:", dbError);
      throw dbError;
    }
  },
});
