/**
 * Basic Filter Effects
 *
 * CSS filter-based and simple pixel manipulation effects for common adjustments:
 * brightness, contrast, saturation, blur, hue rotation, and sharpening.
 */

/**
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Apply brightness effect using CSS filter
 *
 * @param ctx - Canvas 2D context
 * @param params - Effect parameters
 * @param blend - Blend amount (0-1)
 */
export function applyBrightness(
  ctx: CanvasRenderingContext2D,
  params: Record<string, number | string>,
  blend: number = 1.0,
): void {
  const brightness = clamp((params.brightness as number) ?? 1.0, 0, 3);
  
  if (Math.abs(brightness - 1.0) < 0.01 || blend < 0.01) {
    return;
  }

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  if (width === 0 || height === 0) return;

  try {
    // For full blend, use CSS filter (faster)
    if (blend >= 0.99) {
      ctx.filter = `brightness(${brightness})`;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(ctx.canvas, 0, 0);
      
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.filter = 'none';
    } else {
      // For partial blend, use pixel manipulation
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const adjustedBrightness = 1 + (brightness - 1) * blend;
      
      for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(data[i] * adjustedBrightness, 0, 255);
        data[i + 1] = clamp(data[i + 1] * adjustedBrightness, 0, 255);
        data[i + 2] = clamp(data[i + 2] * adjustedBrightness, 0, 255);
      }

      ctx.putImageData(imageData, 0, 0);
    }
  } catch (error) {
    console.error('[BasicFilters] Failed to apply brightness:', error);
  }
}

/**
 * Apply contrast effect using pixel manipulation
 *
 * @param ctx - Canvas 2D context
 * @param params - Effect parameters
 * @param blend - Blend amount (0-1)
 */
export function applyContrast(
  ctx: CanvasRenderingContext2D,
  params: Record<string, number | string>,
  blend: number = 1.0,
): void {
  const contrast = clamp((params.contrast as number) ?? 1.0, 0, 3);

  if (Math.abs(contrast - 1.0) < 0.01 || blend < 0.01) {
    return;
  }

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  if (width === 0 || height === 0) return;

  try {
    // For full blend, use CSS filter (faster)
    if (blend >= 0.99) {
      ctx.filter = `contrast(${contrast})`;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(ctx.canvas, 0, 0);
      
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.filter = 'none';
    } else {
      // For partial blend, use pixel manipulation
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const adjustedContrast = 1 + (contrast - 1) * blend;
      const factor = (259 * (adjustedContrast * 255 + 255)) / (255 * (259 - adjustedContrast * 255));

      for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(factor * (data[i] - 128) + 128, 0, 255);
        data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128, 0, 255);
        data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128, 0, 255);
      }

      ctx.putImageData(imageData, 0, 0);
    }
  } catch (error) {
    console.error('[BasicFilters] Failed to apply contrast:', error);
  }
}

/**
 * Apply saturation effect using HSL color space
 *
 * @param ctx - Canvas 2D context
 * @param params - Effect parameters
 * @param blend - Blend amount (0-1)
 */
export function applySaturation(
  ctx: CanvasRenderingContext2D,
  params: Record<string, number | string>,
  blend: number = 1.0,
): void {
  const saturation = clamp((params.saturation as number) ?? 1.0, 0, 3);

  if (Math.abs(saturation - 1.0) < 0.01 || blend < 0.01) {
    return;
  }

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  if (width === 0 || height === 0) return;

  try {
    // For full blend, use CSS filter (faster)
    if (blend >= 0.99) {
      ctx.filter = `saturate(${saturation})`;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.drawImage(ctx.canvas, 0, 0);
      
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.filter = 'none';
    } else {
      // For partial blend, use pixel manipulation
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const adjustedSaturation = 1 + (saturation - 1) * blend;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Calculate grayscale value
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        // Interpolate between grayscale and original based on saturation
        data[i] = clamp(gray + (r - gray) * adjustedSaturation, 0, 255);
        data[i + 1] = clamp(gray + (g - gray) * adjustedSaturation, 0, 255);
        data[i + 2] = clamp(gray + (b - gray) * adjustedSaturation, 0, 255);
      }

      ctx.putImageData(imageData, 0, 0);
    }
  } catch (error) {
    console.error('[BasicFilters] Failed to apply saturation:', error);
  }
}

/**
 * Apply blur effect using CSS filter
 *
 * @param ctx - Canvas 2D context
 * @param params - Effect parameters
 * @param blend - Blend amount (0-1)
 */
export function applyBlur(
  ctx: CanvasRenderingContext2D,
  params: Record<string, number | string>,
  blend: number = 1.0,
): void {
  const radius = clamp((params.radius as number) ?? 0, 0, 100);

  if (radius < 0.1 || blend < 0.01) {
    return;
  }

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  if (width === 0 || height === 0) return;

  try {
    const adjustedRadius = radius * blend;
    
    ctx.filter = `blur(${adjustedRadius}px)`;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(ctx.canvas, 0, 0);
    
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.filter = 'none';
  } catch (error) {
    console.error('[BasicFilters] Failed to apply blur:', error);
  }
}

/**
 * Apply hue rotation effect using CSS filter
 *
 * @param ctx - Canvas 2D context
 * @param params - Effect parameters
 * @param blend - Blend amount (0-1)
 */
export function applyHue(
  ctx: CanvasRenderingContext2D,
  params: Record<string, number | string>,
  blend: number = 1.0,
): void {
  const rotation = ((params.rotation as number) ?? 0) % 360;

  if (Math.abs(rotation) < 0.1 || blend < 0.01) {
    return;
  }

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  if (width === 0 || height === 0) return;

  try {
    const adjustedRotation = rotation * blend;
    
    ctx.filter = `hue-rotate(${adjustedRotation}deg)`;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(ctx.canvas, 0, 0);
    
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.filter = 'none';
  } catch (error) {
    console.error('[BasicFilters] Failed to apply hue rotation:', error);
  }
}

/**
 * Apply sharpen effect using unsharp mask technique
 *
 * @param ctx - Canvas 2D context
 * @param params - Effect parameters
 * @param blend - Blend amount (0-1)
 */
export function applySharpen(
  ctx: CanvasRenderingContext2D,
  params: Record<string, number | string>,
  blend: number = 1.0,
): void {
  const amount = clamp((params.amount as number) ?? 1.0, 0, 5);

  if (amount < 0.01 || blend < 0.01) {
    return;
  }

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  if (width === 0 || height === 0) return;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const originalData = new Uint8ClampedArray(data);

    const adjustedAmount = amount * blend;

    // Simple sharpen kernel (unsharp mask approximation)
    const kernel = [
      0, -adjustedAmount, 0,
      -adjustedAmount, 1 + 4 * adjustedAmount, -adjustedAmount,
      0, -adjustedAmount, 0
    ];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          
          // Apply 3x3 kernel
          sum += originalData[((y - 1) * width + (x - 1)) * 4 + c] * kernel[0];
          sum += originalData[((y - 1) * width + x) * 4 + c] * kernel[1];
          sum += originalData[((y - 1) * width + (x + 1)) * 4 + c] * kernel[2];
          sum += originalData[(y * width + (x - 1)) * 4 + c] * kernel[3];
          sum += originalData[(y * width + x) * 4 + c] * kernel[4];
          sum += originalData[(y * width + (x + 1)) * 4 + c] * kernel[5];
          sum += originalData[((y + 1) * width + (x - 1)) * 4 + c] * kernel[6];
          sum += originalData[((y + 1) * width + x) * 4 + c] * kernel[7];
          sum += originalData[((y + 1) * width + (x + 1)) * 4 + c] * kernel[8];

          data[(y * width + x) * 4 + c] = clamp(sum, 0, 255);
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (error) {
    console.error('[BasicFilters] Failed to apply sharpen:', error);
  }
}
