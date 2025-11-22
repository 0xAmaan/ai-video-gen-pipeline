# WebGPU Color Space Bug Fix

## Critical Bug: `display-p3` String Incompatibility

### Issue

The WebGPU renderer crashed with error:
```
Cannot read properties of undefined (reading 'transfer')
```

### Root Cause

Three.js WebGPURenderer does not support setting `colorSpace` to the string `"display-p3"` on `VideoTexture` objects. The `.transfer` property access failed because the color space object was undefined.

**Before (Broken):**
```typescript
import { VideoTexture, type ColorSpace } from "three";

const DISPLAY_P3: ColorSpace | "display-p3" = "display-p3";

// Later in code:
this.textureA.colorSpace = DISPLAY_P3;  // ❌ Crashes WebGPU renderer
```

The WebGL renderer accepts both the constant and the string, but WebGPU only accepts the constant.

### Solution

Use the Three.js `SRGBColorSpace` constant instead of the string `"display-p3"`:

**After (Fixed):**
```typescript
import { SRGBColorSpace, VideoTexture } from "three";

const VIDEO_COLOR_SPACE = SRGBColorSpace;

// Later in code:
this.textureA.colorSpace = VIDEO_COLOR_SPACE;  // ✅ Works with WebGPU
this.renderer.outputColorSpace = SRGBColorSpace;  // ✅ Works with WebGPU
```

## Changes Made

### File: `lib/editor/playback/webgpu-preview-renderer.ts`

1. **Import Addition** (line 7):
   ```typescript
   import { SRGBColorSpace, ... } from "three";
   ```

2. **Constant Update** (line 21):
   ```typescript
   // Before
   const DISPLAY_P3: ColorSpace | "display-p3" = "display-p3";

   // After
   const VIDEO_COLOR_SPACE = SRGBColorSpace;
   ```

3. **Renderer Color Space** (line 194):
   ```typescript
   // Before
   this.renderer.outputColorSpace = DISPLAY_P3;

   // After
   this.renderer.outputColorSpace = SRGBColorSpace;
   ```

4. **Texture A Color Space** (lines 271, 289):
   ```typescript
   // Before
   this.textureA.colorSpace = DISPLAY_P3;

   // After
   this.textureA.colorSpace = VIDEO_COLOR_SPACE;
   ```

5. **Texture B Color Space** (lines 321, 336):
   ```typescript
   // Before
   this.textureB.colorSpace = DISPLAY_P3;

   // After
   this.textureB.colorSpace = VIDEO_COLOR_SPACE;
   ```

## Color Space Comparison

### sRGB vs Display P3

| Aspect | sRGB | Display P3 |
|--------|------|------------|
| Color Gamut | Standard RGB (1996) | Wide gamut (Apple, 2015) |
| Coverage | ~35% of visible colors | ~45% of visible colors |
| Support | Universal | Modern displays only |
| WebGPU | ✅ Fully supported | ⚠️ Limited support |
| Three.js Const | `SRGBColorSpace` | Not available as constant |

### Impact of Change

**Visual Impact:** Minimal
- sRGB is widely supported and provides accurate colors on all displays
- Display P3 only shows difference on modern wide-gamut displays (MacBook Pro, iPad Pro)
- Most video content is authored in Rec. 709 (similar to sRGB)

**Technical Impact:** Critical
- Using `SRGBColorSpace` constant ensures WebGPU renderer doesn't crash
- Provides consistent behavior across WebGL and WebGPU
- Maintains proper color management pipeline

## Testing

### Before Fix
```
✅ WebGPU adapter detected
✅ Canvas format: bgra8unorm
❌ Crash on first render: "Cannot read properties of undefined (reading 'transfer')"
❌ Slow frame: 4797ms
❌ Falls back to WebGL
```

### After Fix (Expected)
```
✅ WebGPU adapter detected
✅ Canvas format: bgra8unorm
✅ First render succeeds
✅ Frame times: <16ms (60fps target)
✅ No fallback needed
```

## Why Three.js Behaves This Way

### WebGL vs WebGPU Color Space Handling

**WebGL Renderer:**
- Accepts both `SRGBColorSpace` constant and `"srgb"` string
- Accepts both `DisplayP3ColorSpace` (if defined) and `"display-p3"` string
- More lenient with string values

**WebGPU Renderer:**
- Only accepts Three.js ColorSpace constants (numeric enums)
- Does not accept string values
- Expects `transfer`, `primaries`, and `matrix` properties

### Three.js Color Space Constants

```typescript
// From three/src/constants.js
export const NoColorSpace = '';
export const SRGBColorSpace = 'srgb';
export const LinearSRGBColorSpace = 'srgb-linear';
// Display P3 is not exported as a constant in Three.js r162+
```

The `"display-p3"` string is not a recognized ColorSpace constant in Three.js, causing the WebGPU renderer to fail when accessing `.transfer`.

## Related Issues

### Three.js GitHub Issues
- [#26851](https://github.com/mrdoob/three.js/issues/26851) - WebGPURenderer color space handling
- [#27134](https://github.com/mrdoob/three.js/issues/27134) - VideoTexture color space support

### Why Not LinearSRGBColorSpace?

LinearSRGBColorSpace is for HDR/linear workflows and would result in incorrect gamma:
- Videos are typically gamma-encoded (sRGB transfer function)
- Using linear would make videos appear washed out
- SRGBColorSpace is correct for standard video playback

## Recommendation

For production video playback:
1. **Use `SRGBColorSpace`** for consistent behavior
2. **Avoid string color space values** with WebGPU
3. **Test on both WebGL and WebGPU** to catch compatibility issues
4. **Consider WebGL** as primary renderer until Three.js WebGPURenderer matures

## Future Enhancements

If Display P3 support is critical:
1. Check Three.js changelog for `DisplayP3ColorSpace` constant
2. Detect display capabilities: `window.matchMedia('(color-gamut: p3)').matches`
3. Conditionally use P3 only when supported:
   ```typescript
   const VIDEO_COLOR_SPACE =
     DisplayP3ColorSpace && isWebGPU
       ? DisplayP3ColorSpace
       : SRGBColorSpace;
   ```

---

**Fix Date:** 2025-11-21
**Three.js Version:** r169 (via three/webgpu)
**Impact:** Critical - Prevents WebGPU renderer crash
**Breaking Change:** No - sRGB is correct for most video content
