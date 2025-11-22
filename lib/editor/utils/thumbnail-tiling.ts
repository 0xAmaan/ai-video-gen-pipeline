/**
 * Thumbnail Tiling Utilities
 *
 * Extracted from legacy KonvaClipItem.tsx to provide reusable thumbnail
 * tiling calculations for both Konva-based and CSS-based rendering.
 *
 * Implements CapCut-style horizontal thumbnail tiling with center-cropping
 * for the last tile when needed.
 */

// Thumbnail dimensions from demux-worker.ts
export const THUMBNAIL_WIDTH = 160;
export const THUMBNAIL_HEIGHT = 90;

export interface ThumbnailTile {
  /** Index in the thumbnails array (wraps around if more tiles than thumbnails) */
  thumbnailIndex: number;
  /** X position of the tile relative to clip start */
  x: number;
  /** Width of the tile */
  width: number;
  /** Height of the tile */
  height: number;
  /** If true, this tile is cropped (usually the last tile) */
  isCropped: boolean;
  /** Crop information for center-cropping the thumbnail image */
  crop?: {
    /** X offset in source thumbnail (pixels) */
    x: number;
    /** Y offset in source thumbnail (pixels) */
    y: number;
    /** Width of cropped region in source thumbnail (pixels) */
    width: number;
    /** Height of cropped region in source thumbnail (pixels) */
    height: number;
  };
}

export interface ThumbnailTilingParams {
  /** Width of the clip/element in pixels */
  clipWidth: number;
  /** Height of the clip/element in pixels */
  clipHeight: number;
  /** Number of available thumbnails to cycle through */
  thumbnailCount: number;
}

/**
 * Calculate thumbnail tiles for a clip with CapCut-style tiling
 *
 * @param params - Tiling parameters (clip dimensions and thumbnail count)
 * @returns Array of tile specifications for rendering
 *
 * @example
 * ```ts
 * const tiles = calculateThumbnailTiles({
 *   clipWidth: 500,
 *   clipHeight: 60,
 *   thumbnailCount: 12
 * });
 *
 * tiles.forEach((tile, i) => {
 *   console.log(`Tile ${i}: thumbnail[${tile.thumbnailIndex}] at x=${tile.x}, w=${tile.width}`);
 *   if (tile.isCropped) {
 *     console.log(`  Cropped: ${tile.crop}`);
 *   }
 * });
 * ```
 */
export function calculateThumbnailTiles(
  params: ThumbnailTilingParams
): ThumbnailTile[] {
  const { clipWidth, clipHeight, thumbnailCount } = params;

  if (clipWidth <= 0 || clipHeight <= 0 || thumbnailCount <= 0) {
    return [];
  }

  const thumbnailAspectRatio = THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT;

  // Calculate tile width maintaining aspect ratio based on clip height
  const tileWidth = clipHeight * thumbnailAspectRatio;

  // Calculate how many tiles we need to fill the clip width
  const tilesNeeded = Math.ceil(clipWidth / tileWidth);

  const tiles: ThumbnailTile[] = [];

  for (let i = 0; i < tilesNeeded; i++) {
    const thumbnailIndex = i % thumbnailCount; // Cycle through thumbnails
    const tileX = i * tileWidth;

    // For the last tile, we might need to crop from the center
    const isLastTile = i === tilesNeeded - 1;
    const remainingWidth = clipWidth - (i * tileWidth);

    if (isLastTile && remainingWidth < tileWidth) {
      // Center-crop: show the middle portion of the thumbnail
      const cropRatio = remainingWidth / tileWidth;
      const croppedPixelWidth = THUMBNAIL_WIDTH * cropRatio;
      const cropStartX = (THUMBNAIL_WIDTH - croppedPixelWidth) / 2; // Center the crop

      tiles.push({
        thumbnailIndex,
        x: tileX,
        width: remainingWidth,
        height: clipHeight,
        isCropped: true,
        crop: {
          x: cropStartX,
          y: 0,
          width: croppedPixelWidth,
          height: THUMBNAIL_HEIGHT,
        },
      });
    } else {
      // Full tile
      tiles.push({
        thumbnailIndex,
        x: tileX,
        width: tileWidth,
        height: clipHeight,
        isCropped: false,
      });
    }
  }

  return tiles;
}

/**
 * Generate CSS background-image value for repeating thumbnail tiles
 *
 * @param thumbnails - Array of thumbnail data URLs
 * @param clipHeight - Height of the clip in pixels (for aspect ratio calculation)
 * @returns CSS background-image value with proper sizing and positioning
 *
 * @example
 * ```ts
 * const bgImage = generateThumbnailBackgroundCSS(asset.thumbnails, 60);
 * // Returns: "url(...), url(...), ..."
 * ```
 */
export function generateThumbnailBackgroundCSS(
  thumbnails: string[],
  clipHeight: number = 60
): string {
  if (!thumbnails.length) return "none";

  const thumbnailAspectRatio = THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT;
  const tileWidth = clipHeight * thumbnailAspectRatio;

  // Create repeating background-image pattern
  // Each thumbnail is sized to maintain aspect ratio and repeats horizontally
  return thumbnails.map((url) => `url("${url}")`).join(", ");
}

/**
 * Calculate optimal thumbnail size for CSS background-size
 *
 * @param clipHeight - Height of the clip in pixels
 * @returns CSS background-size value (e.g., "106.67px 60px")
 */
export function calculateThumbnailBackgroundSize(clipHeight: number = 60): string {
  const thumbnailAspectRatio = THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT;
  const tileWidth = clipHeight * thumbnailAspectRatio;

  return `${tileWidth}px ${clipHeight}px`;
}
