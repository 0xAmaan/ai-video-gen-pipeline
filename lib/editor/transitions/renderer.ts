/**
 * Transition Renderer
 *
 * Implements Canvas API-based rendering for transition effects.
 * Each transition type has a render function that blends two frames
 * based on progress (0 to 1).
 */

import type { TransitionType } from "./presets";

export type TransitionRenderContext = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  fromFrame: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement;
  toFrame: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement;
  progress: number; // 0 to 1
};

/**
 * Render a transition between two frames
 */
export function renderTransition(
  type: TransitionType,
  context: TransitionRenderContext,
): void {
  const { ctx, width, height, fromFrame, toFrame, progress } = context;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  switch (type) {
    case "fade":
    case "dissolve":
      renderFade(ctx, width, height, fromFrame, toFrame, progress);
      break;
    case "wipe-left":
      renderWipeLeft(ctx, width, height, fromFrame, toFrame, progress);
      break;
    case "wipe-right":
      renderWipeRight(ctx, width, height, fromFrame, toFrame, progress);
      break;
    case "wipe-up":
      renderWipeUp(ctx, width, height, fromFrame, toFrame, progress);
      break;
    case "wipe-down":
      renderWipeDown(ctx, width, height, fromFrame, toFrame, progress);
      break;
    case "slide-left":
      renderSlideLeft(ctx, width, height, fromFrame, toFrame, progress);
      break;
    case "slide-right":
      renderSlideRight(ctx, width, height, fromFrame, toFrame, progress);
      break;
    case "slide-up":
      renderSlideUp(ctx, width, height, fromFrame, toFrame, progress);
      break;
    case "slide-down":
      renderSlideDown(ctx, width, height, fromFrame, toFrame, progress);
      break;
    case "zoom-in":
      renderZoomIn(ctx, width, height, fromFrame, toFrame, progress);
      break;
    case "zoom-out":
      renderZoomOut(ctx, width, height, fromFrame, toFrame, progress);
      break;
    default:
      // Fallback to simple fade
      renderFade(ctx, width, height, fromFrame, toFrame, progress);
  }
}

/**
 * FADE / DISSOLVE TRANSITION
 * Cross-fade between two frames using opacity
 */
function renderFade(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fromFrame: CanvasImageSource,
  toFrame: CanvasImageSource,
  progress: number,
): void {
  // Draw from frame with decreasing opacity
  ctx.globalAlpha = 1 - progress;
  ctx.drawImage(fromFrame, 0, 0, width, height);

  // Draw to frame with increasing opacity
  ctx.globalAlpha = progress;
  ctx.drawImage(toFrame, 0, 0, width, height);

  // Reset alpha
  ctx.globalAlpha = 1;
}

/**
 * WIPE LEFT TRANSITION
 * New frame wipes in from right to left
 */
function renderWipeLeft(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fromFrame: CanvasImageSource,
  toFrame: CanvasImageSource,
  progress: number,
): void {
  // Draw full from frame
  ctx.drawImage(fromFrame, 0, 0, width, height);

  // Calculate wipe position (right to left)
  const wipeX = width * (1 - progress);

  // Clip and draw to frame
  ctx.save();
  ctx.beginPath();
  ctx.rect(wipeX, 0, width - wipeX, height);
  ctx.clip();
  ctx.drawImage(toFrame, 0, 0, width, height);
  ctx.restore();
}

/**
 * WIPE RIGHT TRANSITION
 * New frame wipes in from left to right
 */
function renderWipeRight(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fromFrame: CanvasImageSource,
  toFrame: CanvasImageSource,
  progress: number,
): void {
  // Draw full from frame
  ctx.drawImage(fromFrame, 0, 0, width, height);

  // Calculate wipe width (left to right)
  const wipeWidth = width * progress;

  // Clip and draw to frame
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, wipeWidth, height);
  ctx.clip();
  ctx.drawImage(toFrame, 0, 0, width, height);
  ctx.restore();
}

/**
 * WIPE UP TRANSITION
 * New frame wipes in from bottom to top
 */
function renderWipeUp(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fromFrame: CanvasImageSource,
  toFrame: CanvasImageSource,
  progress: number,
): void {
  // Draw full from frame
  ctx.drawImage(fromFrame, 0, 0, width, height);

  // Calculate wipe position (bottom to top)
  const wipeY = height * (1 - progress);

  // Clip and draw to frame
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, wipeY, width, height - wipeY);
  ctx.clip();
  ctx.drawImage(toFrame, 0, 0, width, height);
  ctx.restore();
}

/**
 * WIPE DOWN TRANSITION
 * New frame wipes in from top to bottom
 */
function renderWipeDown(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fromFrame: CanvasImageSource,
  toFrame: CanvasImageSource,
  progress: number,
): void {
  // Draw full from frame
  ctx.drawImage(fromFrame, 0, 0, width, height);

  // Calculate wipe height (top to bottom)
  const wipeHeight = height * progress;

  // Clip and draw to frame
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, wipeHeight);
  ctx.clip();
  ctx.drawImage(toFrame, 0, 0, width, height);
  ctx.restore();
}

/**
 * SLIDE LEFT TRANSITION
 * Both frames slide left
 */
function renderSlideLeft(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fromFrame: CanvasImageSource,
  toFrame: CanvasImageSource,
  progress: number,
): void {
  const offset = width * progress;

  // Draw from frame sliding out to the left
  ctx.drawImage(fromFrame, -offset, 0, width, height);

  // Draw to frame sliding in from the right
  ctx.drawImage(toFrame, width - offset, 0, width, height);
}

/**
 * SLIDE RIGHT TRANSITION
 * Both frames slide right
 */
function renderSlideRight(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fromFrame: CanvasImageSource,
  toFrame: CanvasImageSource,
  progress: number,
): void {
  const offset = width * progress;

  // Draw from frame sliding out to the right
  ctx.drawImage(fromFrame, offset, 0, width, height);

  // Draw to frame sliding in from the left
  ctx.drawImage(toFrame, -width + offset, 0, width, height);
}

/**
 * SLIDE UP TRANSITION
 * Both frames slide up
 */
function renderSlideUp(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fromFrame: CanvasImageSource,
  toFrame: CanvasImageSource,
  progress: number,
): void {
  const offset = height * progress;

  // Draw from frame sliding out upward
  ctx.drawImage(fromFrame, 0, -offset, width, height);

  // Draw to frame sliding in from bottom
  ctx.drawImage(toFrame, 0, height - offset, width, height);
}

/**
 * SLIDE DOWN TRANSITION
 * Both frames slide down
 */
function renderSlideDown(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fromFrame: CanvasImageSource,
  toFrame: CanvasImageSource,
  progress: number,
): void {
  const offset = height * progress;

  // Draw from frame sliding out downward
  ctx.drawImage(fromFrame, 0, offset, width, height);

  // Draw to frame sliding in from top
  ctx.drawImage(toFrame, 0, -height + offset, width, height);
}

/**
 * ZOOM IN TRANSITION
 * New frame zooms in from center
 */
function renderZoomIn(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fromFrame: CanvasImageSource,
  toFrame: CanvasImageSource,
  progress: number,
): void {
  // Draw full from frame
  ctx.drawImage(fromFrame, 0, 0, width, height);

  // Calculate zoom scale (0 to 1)
  const scale = progress;
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const offsetX = (width - scaledWidth) / 2;
  const offsetY = (height - scaledHeight) / 2;

  // Draw to frame zoomed in with increasing opacity
  ctx.globalAlpha = progress;
  ctx.drawImage(toFrame, offsetX, offsetY, scaledWidth, scaledHeight);
  ctx.globalAlpha = 1;
}

/**
 * ZOOM OUT TRANSITION
 * Old frame zooms out to reveal new frame
 */
function renderZoomOut(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fromFrame: CanvasImageSource,
  toFrame: CanvasImageSource,
  progress: number,
): void {
  // Draw full to frame
  ctx.drawImage(toFrame, 0, 0, width, height);

  // Calculate zoom scale (1 to 1.5 then fade)
  const scale = 1 + progress * 0.5;
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const offsetX = (width - scaledWidth) / 2;
  const offsetY = (height - scaledHeight) / 2;

  // Draw from frame zooming out with decreasing opacity
  ctx.globalAlpha = 1 - progress;
  ctx.drawImage(fromFrame, offsetX, offsetY, scaledWidth, scaledHeight);
  ctx.globalAlpha = 1;
}
