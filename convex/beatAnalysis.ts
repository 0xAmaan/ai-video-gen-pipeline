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

import { mutation, internalAction, internalMutation } from "./_generated/server";
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
async function parseReplicateOutput(output: unknown): Promise<{
  beatMarkers: BeatMarker[];
  bpm: number | undefined;
}> {
  console.log("[parseReplicateOutput] Parsing Replicate output...");

  // Default return value
  const result = {
    beatMarkers: [] as BeatMarker[],
    bpm: undefined as number | undefined,
  };

  if (!output || typeof output !== "object") {
    console.warn("[parseReplicateOutput] Invalid output format:", typeof output);
    return result;
  }

  // Replicate often returns an array with a single element containing the results
  let data: ReplicateAnalysisOutput;
  const outputArray = output as any;

  if (outputArray['0']) {
    const firstElement = outputArray['0'];

    // Check if it's a ReadableStream (has _reader, _state properties)
    if (firstElement && typeof firstElement === 'object' && '_reader' in firstElement) {
      console.log("[parseReplicateOutput] Output is a ReadableStream, need to read it");
      // This is a stream - Replicate returns file outputs as streams
      // We need to convert it to a blob/text first
      const blob = await new Response(firstElement).blob();
      const text = await blob.text();
      data = JSON.parse(text);
      console.log("[parseReplicateOutput] Parsed stream data keys:", Object.keys(data));
    } else if (typeof firstElement === 'string' && firstElement.startsWith('http')) {
      // Output is an array with URL to JSON results file
      console.log("[parseReplicateOutput] Fetching results from URL:", firstElement);
      const response = await fetch(firstElement);
      data = await response.json();
      console.log("[parseReplicateOutput] Fetched data keys:", Object.keys(data));
    } else if (typeof firstElement === 'object') {
      // Output is an array with the results object directly
      console.log("[parseReplicateOutput] Using first array element as data");
      data = firstElement as ReplicateAnalysisOutput;
      console.log("[parseReplicateOutput] Data keys:", Object.keys(data));
    } else {
      data = output as ReplicateAnalysisOutput;
    }
  } else {
    data = output as ReplicateAnalysisOutput;
  }

  // Helper function to fetch JSON from URL if needed
  async function getDataFromUrlOrDirect(value: any): Promise<any> {
    if (typeof value === 'string' && value.startsWith('http')) {
      console.log(`[parseReplicateOutput] Fetching data from URL: ${value}`);
      const response = await fetch(value);
      return await response.json();
    }
    return value;
  }

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
  const beatsData = await getDataFromUrlOrDirect(data.beats);
  if (Array.isArray(beatsData)) {
    beats = beatsData.filter((b) => typeof b === "number");
  }

  // Extract downbeats array (may be URL or direct array)
  let downbeats: number[] = [];
  const downbeatsData = await getDataFromUrlOrDirect(data.downbeats);
  if (Array.isArray(downbeatsData)) {
    downbeats = downbeatsData.filter((d) => typeof d === "number");
  }

  console.log(`[parseReplicateOutput] Extracted ${beats.length} beats, ${downbeats.length} downbeats`);

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
      const { beatMarkers, bpm } = await parseReplicateOutput(output);

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
