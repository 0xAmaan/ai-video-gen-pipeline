"use client";

import { useEffect } from "react";
import { useProjectStore } from "@/lib/editor/core/project-store";

/**
 * ThumbnailInjector Component
 *
 * Dynamically injects CSS to display video thumbnails on Twick timeline elements.
 * Uses CSS ::before pseudo-elements with background-image tiling to match CapCut-style preview.
 *
 * How it works:
 * 1. Monitors project state for clips and assets
 * 2. For each clip with video thumbnails, generates CSS rules
 * 3. Uses CSS background-image with repeat-x to tile thumbnails horizontally
 * 4. Injects CSS into <style> tag in document head
 * 5. Cleans up on unmount
 */
export const ThumbnailInjector = () => {
  const project = useProjectStore((state) => state.project);
  const assets = project?.mediaAssets ?? {};

  useEffect(() => {
    if (!project) return;

    // Thumbnail dimensions from demux-worker.ts (160x90)
    const THUMBNAIL_WIDTH = 160;
    const THUMBNAIL_HEIGHT = 90;
    const CLIP_HEIGHT = 60; // Twick timeline element height (approximate)

    const thumbnailAspectRatio = THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT;
    const tileWidth = CLIP_HEIGHT * thumbnailAspectRatio; // Maintain aspect ratio

    const cssRules: string[] = [];

    // Iterate through all sequences, tracks, and clips
    project.sequences.forEach((sequence) => {
      sequence.tracks.forEach((track) => {
        track.clips.forEach((clip) => {
          const asset = assets[clip.mediaId];

          // Only process video clips with thumbnails
          if (!asset || asset.type !== "video" || !asset.thumbnails?.length) {
            return;
          }

          // Create repeating background-image pattern from all thumbnails
          // This creates a tiled effect similar to CapCut
          const thumbnailUrls = asset.thumbnails.map((t) => `url("${t}")`);

          // Generate CSS rule for this specific clip element
          // Note: data-element-id is added by ElementIdInjector component
          cssRules.push(`
            .twick-track-element[data-element-id="${clip.id}"]::before {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-image: ${thumbnailUrls.join(", ")};
              background-size: auto 100%;
              background-repeat: repeat-x;
              background-position: left center;
              z-index: 0;
              pointer-events: none;
              opacity: 0.9;
            }

            /* Ensure element content (text labels) appears above thumbnails */
            .twick-track-element[data-element-id="${clip.id}"] .twick-track-element-content {
              position: relative;
              z-index: 1;
              color: white;
              text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
            }

            /* Dim thumbnails when element is selected for better text visibility */
            .twick-track-element[data-element-id="${clip.id}"].twick-track-element-selected::before {
              opacity: 0.6;
            }
          `);
        });
      });
    });

    // Inject or update the style tag
    let styleEl = document.getElementById("twick-thumbnails-css") as HTMLStyleElement;

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "twick-thumbnails-css";
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = cssRules.join("\n");

    // Cleanup: remove style tag on unmount
    return () => {
      const el = document.getElementById("twick-thumbnails-css");
      if (el) {
        el.remove();
      }
    };
  }, [project, assets]);

  // This is a utility component that doesn't render anything
  return null;
};
