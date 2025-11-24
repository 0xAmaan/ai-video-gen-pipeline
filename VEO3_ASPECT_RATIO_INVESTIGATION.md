# Veo 3.1 Square Video Investigation

## Issue Report
Some Veo 3.1 videos are rendering as square (1:1) instead of widescreen (16:9).

## Investigation Summary

**Status**: ✅ **ISSUE CONFIRMED AND ROOT CAUSE IDENTIFIED**

The issue is NOT with Veo 3.1 - it's with the **image generation step** producing square (1:1) images instead of widescreen (16:9) images.

### Root Cause Analysis

1. **Code Review**: All three video generation API routes correctly set `aspect_ratio: "16:9"` for Veo 3.1:
   - `app/api/generate-video-clip/route.ts:78`
   - `app/api/generate-all-clips/route.ts:171`
   - `app/api/retry-video-clip/route.ts:99`

2. **Image Generation**: Storyboard images are generated via Leonardo Phoenix with `aspect_ratio: "16:9"`:
   - `app/api/generate-storyboard/route.ts:56`

3. **Replicate API Documentation** (from ModelSelectorPRD.md):
   - Veo 3.1 supports `aspect_ratio: ["16:9", "9:16"]`
   - Image parameter description: *"Ideal images are 16:9 or 9:16 and 1280x720 or 720x1280, **depending on the aspect ratio you choose**"*
   - Unlike Kling and SeeDance, Veo 3.1 does NOT say "aspect ratio is ignored if image is provided"

### Possible Causes

**Theory 1: Input Image Dimensions Override**
Even though the API accepts an `aspect_ratio` parameter, Veo 3.1 might be:
- Detecting the actual dimensions of the input image
- Using those dimensions instead of the `aspect_ratio` parameter if they don't match
- Defaulting to 1:1 if the input image is square or close to square

**Theory 2: Leonardo Phoenix Output Variance**
Leonardo Phoenix might occasionally produce images that aren't exactly 16:9:
- The model might interpret "16:9" loosely
- Network issues during download could corrupt aspect ratio
- Image processing/resizing somewhere in the pipeline

**Theory 3: Replicate API Inconsistency**
The `aspect_ratio` parameter might be:
- Ignored when an `image` parameter is provided (undocumented behavior)
- Only respected when the input image dimensions closely match
- Subject to model version changes

## Changes Made

### 1. Model Configuration Update
**File**: `lib/types/models.ts`
- Updated Veo 3.1 and Veo 3.1 Fast `supportedAspectRatios` from `["16:9"]` to `["16:9", "9:16"]`
- This reflects the actual Replicate API capabilities

### 2. Enhanced Logging
Added detailed logging to diagnose the issue:

**File**: `app/api/generate-video-clip/route.ts:78-80`
```typescript
console.log(`[Veo 3.1] Forcing aspect_ratio to 16:9 for image: ${imageUrl}`);
```

**File**: `app/api/generate-all-clips/route.ts:171-173`
```typescript
console.log(`[Veo 3.1] Scene ${scene.sceneNumber}: Setting aspect_ratio=16:9 for image: ${scene.imageUrl?.substring(0, 80)}...`);
console.log(`[Veo 3.1] Full input:`, JSON.stringify(input, null, 2));
```

## Next Steps for Debugging

1. **Check Server Logs**: When a square video is generated, look for:
   - The `[Veo 3.1]` log messages showing the input configuration
   - The actual image URL being sent to Replicate
   - The full input JSON to verify `aspect_ratio: "16:9"` is present

2. **Verify Image Dimensions**: Download a few generated storyboard images and check:
   - Actual pixel dimensions (should be 1280x720 or similar 16:9 ratio)
   - File metadata for aspect ratio information
   - Whether specific scenes consistently produce square videos

3. **Test Input Image Matching**: Try generating with:
   - Pre-validated 16:9 images (1280x720, 1920x1080)
   - Square images (1024x1024) with `aspect_ratio: "16:9"` to see if it gets overridden
   - Different aspect ratios to understand the behavior

## Potential Fixes (if issue persists)

### Option 1: Pre-resize Input Images
Before sending to Veo 3.1, explicitly resize/crop all input images to exact 16:9 dimensions:
- Add image processing middleware
- Use sharp or similar library to enforce 1280x720 or 1920x1080
- Crop from center if needed

### Option 2: Validate Image Aspect Ratio
Add validation before video generation:
```typescript
// Pseudo-code
const imageAspectRatio = await getImageDimensions(imageUrl);
if (!isCloseToAspectRatio(imageAspectRatio, 16/9, tolerance=0.05)) {
  console.warn(`Image aspect ratio ${imageAspectRatio} doesn't match 16:9`);
  // Option: reject, warn, or pre-process
}
```

### Option 3: Use Different Image Model
If Leonardo Phoenix produces inconsistent aspect ratios:
- Try FLUX Pro or FLUX Schnell which might have better 16:9 consistency
- Add explicit width/height parameters if the model supports them

### Option 4: Contact Replicate Support
If the issue is confirmed to be an API bug:
- Document with specific prediction IDs showing the issue
- Provide input JSON showing `aspect_ratio: "16:9"` is set
- Show output videos that are square despite the parameter

## Model Comparison Notes

From the PRD, other models' behavior with input images:

**Kling v2.5 Turbo Pro**:
> "Aspect ratio of the video. **Ignored if start_image is provided.**"

**SeeDance Models**:
> "Video aspect ratio. **Ignored if an image is used.**"

**Hailuo 2.3 Fast**:
> "The output video will have the **same aspect ratio as this image**."

This suggests the industry standard is to match the input image's aspect ratio, which makes Veo 3.1's documented behavior (respecting the parameter) actually more flexible but potentially less predictable.

## CONFIRMED ROOT CAUSE ✅

**Issue**: Some storyboard images are being generated as **1024x1024 (square/1:1)** instead of 16:9, despite `aspect_ratio: "16:9"` being set in the image generation API call.

**Evidence from project k177qpt9yrx19aagtdmabp1r9d7w0342**:
- Scene 1: **1024x1024 (1:1) - SQUARE** ❌
- Scene 2: 2752x1536 (16:9) ✓
- Scene 3: 2752x1536 (16:9) ✓
- Scene 5: 2720x1568 (~16:9) ✓

**Veo 3.1 Behavior**: When Veo 3.1 receives a square input image, it produces a square output video, **ignoring the `aspect_ratio: "16:9"` parameter** in favor of matching the input image's dimensions.

**Image Model Issue**: The image generation model (likely Nano Banana Pro or similar) is intermittently ignoring the `aspect_ratio` parameter and producing 1:1 images.

## Solution Required

We need to ensure ALL storyboard images are generated at 16:9 before being sent to Veo 3.1. Three approaches:

### Option 1: Fix Image Generation (Recommended)
Ensure the image generation API always produces 16:9 images:
- Verify which image model is being used (check user's model store settings)
- Test if the model supports `aspect_ratio` parameter correctly
- Consider switching to a more reliable model for consistent aspect ratios
- Add validation to reject non-16:9 images at generation time

### Option 2: Pre-process Images
Add image preprocessing before video generation:
```typescript
// Pseudo-code
const imageBuffer = await fetch(imageUrl).then(r => r.arrayBuffer());
const image = sharp(imageBuffer);
const metadata = await image.metadata();

if (metadata.width / metadata.height !== 16/9) {
  // Resize/crop to 16:9
  const resized = await image
    .resize({ width: 1280, height: 720, fit: 'cover' })
    .toBuffer();
  // Upload to R2 and use new URL
}
```

### Option 3: Validation and User Warning
Detect and warn about square images:
```typescript
if (aspectRatio < 1.6 || aspectRatio > 1.85) {
  throw new Error(`Image aspect ratio ${aspectRatio} is not 16:9. Please regenerate the scene.`);
}
```

## Next Steps

1. **Check which image model was used** for scene 1 (the square one)
2. **Test if Nano Banana Pro respects `aspect_ratio`** parameter consistently
3. **Implement Option 1 or 2** to fix the issue at the source
4. **Add validation** to prevent square images from reaching Veo 3.1
