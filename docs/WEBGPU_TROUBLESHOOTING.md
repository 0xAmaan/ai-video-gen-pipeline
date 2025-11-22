# WebGPU Troubleshooting Guide

## Overview

This guide helps diagnose and resolve WebGPU issues in the video editor. The editor uses WebGPU for high-performance video preview rendering when available, with automatic fallback to WebGL/Canvas2D.

## Quick Diagnostics

### 1. Check WebGPU Availability

Open your browser's DevTools console and run:

```javascript
console.log('WebGPU available:', Boolean(navigator.gpu));
```

**Expected:** `true` on Arc browser with macOS Sequoia 15+ on M-series Macs

### 2. Check GPU Status (Arc Browser)

Navigate to: `chrome://gpu`

Look for:
- **WebGPU:** Should show "Hardware accelerated"
- **Graphics Feature Status:** Should show "WebGPU: Enabled"

### 3. Check Console Logs

Load your video project and look for these logs:

```
[WebGPU] Adapter detected: { vendor: "Apple", architecture: "common-3", device: "Apple M1/M2/M3" }
[WebGPU] Canvas format: bgra8unorm
```

## Common Issues

### Issue 1: "WebGPU is not available in this browser"

**Symptoms:**
- Console error: `WebGPU is not available in this browser`
- Editor falls back to WebGL immediately

**Causes:**
1. Browser doesn't support WebGPU
2. WebGPU disabled via flags
3. Running on unsupported OS version

**Solutions:**

#### For Arc Browser (macOS)
1. Navigate to `chrome://flags/#enable-unsafe-webgpu`
2. Set to "Enabled"
3. Restart Arc browser
4. Verify at `chrome://gpu`

#### For Safari (macOS Sequoia 15+)
WebGPU is enabled by default. No configuration needed.

#### Check macOS Version
WebGPU requires **macOS Sequoia 15** or later. Verify with:
```bash
sw_vers -productVersion
```

---

### Issue 2: "WebGPU adapter unavailable"

**Symptoms:**
- Console error: `WebGPU adapter unavailable - hardware may not support WebGPU`
- Falls back to WebGL after adapter test fails

**Causes:**
1. **M3 Pro MacBook Pro Bug:** Known issue with Chrome 140/144 on M3 Pro
2. Hardware doesn't support WebGPU
3. GPU drivers outdated

**Solutions:**

#### M3 Pro Users
This is a known bug. The editor will automatically fall back to WebGL, which works reliably.

**Workaround:** Use Safari instead of Arc/Chrome on M3 Pro (WebGPU more stable)

#### Check Hardware Support
1. Go to `chrome://gpu`
2. Look for "WebGPU" section
3. If showing "Software only" or "Disabled", hardware doesn't support it

#### Update macOS
```bash
# Check for updates
softwareupdate --list

# Install all updates
softwareupdate --install --all
```

---

### Issue 3: Slow Performance / Frame Rate Drops

**Symptoms:**
- Console warnings: `[WebGPU] Slow frame detected: 45.23ms (target <16ms for 60fps)`
- Timeline scrubbing is laggy
- Video preview stutters during playback

**Causes:**
1. Three.js WebGPURenderer performance issues (known experimental issue)
2. Metal backend texture transfer overhead on macOS
3. Large 4K video files
4. Too many render items (known UBO bottleneck in Three.js)

**Solutions:**

#### Switch to WebGL Mode (Recommended)
1. In the editor, switch to "Legacy" timeline mode
2. This forces WebGL renderer (more stable)
3. WebGL is production-ready, WebGPU is experimental

#### Monitor Performance
Check console for performance summary:
```
[WebGPU] Performance summary: 100 slow frames, avg: 35.42ms
```

If average >32ms consistently, WebGL is recommended.

#### Reduce Video Resolution
- Use 1080p proxies for 4K videos
- Transcode videos to lower bitrate

---

### Issue 4: Metal Backend Warnings

**Symptoms:**
- Console shows: `[WebGPU] Canvas format: rgba8unorm` (should be `bgra8unorm` on macOS)
- Texture update warnings
- Color banding or artifacts

**Causes:**
Metal backend on macOS requires `bgra8unorm` format, but Three.js may try to use `rgba8unorm`

**Solutions:**

This is logged for diagnostics. The Three.js WebGPURenderer should handle this automatically.

If you see visual artifacts:
1. Switch to WebGL mode (Legacy timeline)
2. Report the issue with your console logs

---

### Issue 5: Browser-Specific Issues

#### Arc Browser

**WebGPU in Web Workers Fails**
- Known bug: WebGPU doesn't work in Web Workers in Arc
- Solution: Editor doesn't use Workers for WebGPU, no action needed

**Access Chrome URLs**
- In Arc, `chrome://gpu` and `chrome://flags` work identically to Chrome

#### Safari

**Better WebGPU Stability on M3 Pro**
- Safari has more stable WebGPU implementation than Chrome on M3 Pro
- Consider using Safari if Arc/Chrome has issues

---

## Configuration Options

### Enable WebGPU (if disabled)

#### Arc/Chrome
```
1. chrome://flags/#enable-unsafe-webgpu → Enabled
2. Restart browser
```

#### Safari
Enabled by default on macOS Sequoia 15+. No flags needed.

### Force WebGL Mode

In the editor UI:
1. Switch timeline mode to "Legacy"
2. WebGL is used automatically
3. More stable for production use

### Launch Arc with WebGPU (Terminal)
```bash
/Applications/Arc.app/Contents/MacOS/Arc --enable-unsafe-webgpu
```

---

## Diagnostic Logs

When reporting issues, include these logs from the console:

### WebGPU Initialization
```
[WebGPU] Adapter detected: ...
[WebGPU] Canvas format: ...
```

### Error Logs
```
[WebGPU Error] { type: "adapter_unavailable", ... }
```

### Performance Logs
```
[WebGPU] Slow frame detected: ...
[WebGPU] Performance summary: ...
```

### Renderer Selection
```
[WebGPU] Renderer creation failed, falling back to WebGL
[Renderer] Attach failed: ...
```

---

## Browser Compatibility Matrix

| Browser        | macOS Version  | M1/M2 Support | M3 Pro Support | Notes                          |
|----------------|----------------|---------------|----------------|--------------------------------|
| Arc (Chromium) | Sequoia 15+    | ✅ Full        | ⚠️ Buggy       | M3 Pro has init bugs (auto-fallback) |
| Safari         | Sequoia 15+    | ✅ Full        | ✅ Full         | Most stable on M3 Pro          |
| Chrome         | Sequoia 15+    | ✅ Full        | ⚠️ Buggy       | Same as Arc (Chromium-based)   |
| Firefox        | Any            | ❌ Not supported | ❌ Not supported | No WebGPU support yet        |

---

## Known Limitations

### Three.js WebGPURenderer (Experimental)
- **Performance:** 4x slower than WebGL in some scenes
- **UBO Bottleneck:** High overhead with many render items
- **TypeScript:** Not in official Three.js types
- **Documentation:** No official migration guide

**Recommendation:** Use WebGL (Legacy mode) for production until Three.js WebGPURenderer matures.

### macOS Metal Backend Issues
1. **Texture Format:** Requires `bgra8unorm`, not `rgba8unorm`
2. **Copy Operations:** May require blit emulation
3. **IOSurface Limitation:** Canvas textures limited to `bgra8unorm`
4. **Compressed Textures:** M1 GPU supports ASTC/BC/ETC2 but only BC reported

### Safari Buffer Limits
- **iPhone 6:** 256 MB default buffer size
- **iPad Pro:** 993 MB max buffer size
- **Impact:** Large 4K videos may hit limits

---

## Testing Checklist

Before reporting issues, verify:

- [ ] Checked `chrome://gpu` shows WebGPU enabled
- [ ] macOS Sequoia 15+ installed (`sw_vers -productVersion`)
- [ ] Arc browser updated to latest version
- [ ] Console shows no `[WebGPU Error]` logs
- [ ] Tried both "Twick" (WebGPU) and "Legacy" (WebGL) modes
- [ ] Collected diagnostic logs from console

---

## When to Use WebGL vs WebGPU

### Use WebGL (Legacy Mode) ✅
- **Production projects** requiring stability
- **M3 Pro MacBook Pro** (adapter bugs)
- **Large 4K videos** (better memory handling)
- **Consistent performance** needed

### Use WebGPU (Twick Mode) 🧪
- **Testing new features** (zero-copy pipeline)
- **M1/M2 MacBook Pro** (stable)
- **Experimentation** with cutting-edge tech
- **Future-proofing** (when Three.js matures)

**Current Recommendation:** Default to WebGL (Legacy) for reliability. The editor automatically falls back if WebGPU fails.

---

## Performance Targets

### Acceptable Frame Times
- **Excellent:** <16ms (60 fps)
- **Good:** 16-32ms (30-60 fps)
- **Poor:** >32ms (<30 fps)

### What to Expect
- **WebGL:** Consistently 10-16ms on M-series Macs
- **WebGPU:** 15-35ms (experimental, variable)

---

## Getting Help

If WebGPU issues persist:

1. **Collect Logs:** Copy all `[WebGPU]` and `[Renderer]` console logs
2. **System Info:** Include macOS version, browser, and Mac model
3. **GPU Info:** Screenshot of `chrome://gpu` page
4. **Reproduce:** Note exact steps to reproduce the issue
5. **Report:** File an issue with all above information

---

## Advanced: Direct WebGPU Testing

Test WebGPU directly in console:

```javascript
// Test adapter request
(async () => {
  if (!navigator.gpu) {
    console.log('WebGPU not available');
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.log('Adapter request failed');
    return;
  }

  console.log('Adapter available!');

  // Get adapter info (Chrome only)
  const info = await adapter.requestAdapterInfo?.();
  console.log('Adapter info:', {
    vendor: info?.vendor,
    architecture: info?.architecture,
    device: info?.device,
  });

  // Check preferred format
  const format = navigator.gpu.getPreferredCanvasFormat();
  console.log('Preferred canvas format:', format);
  // macOS should show: "bgra8unorm"
})();
```

Expected output on working system:
```
Adapter available!
Adapter info: { vendor: "Apple", architecture: "common-3", device: "Apple M1" }
Preferred canvas format: bgra8unorm
```

---

## References

- [WebGPU Browser Support](https://caniuse.com/webgpu)
- [Three.js WebGPURenderer Docs](https://threejs.org/docs/#api/en/renderers/WebGPURenderer)
- [macOS WebGPU Announcements](https://webkit.org/blog/)
- [Arc Browser WebGPU Status](https://arc.net/support)

---

**Last Updated:** 2025-11-21
**Editor Version:** 1.0
**WebGPU Implementation:** `lib/editor/playback/webgpu-preview-renderer.ts`
