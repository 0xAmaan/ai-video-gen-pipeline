# R2 Thumbnail Storage Implementation

## Overview

This system stores video thumbnails in Cloudflare R2 instead of embedding them as base64 data URLs in the project state. This dramatically reduces Convex document size and improves performance.

## Architecture

### Before (Base64 Storage)
- **Size per thumbnail**: 10-20KB (base64 encoded JPEG)
- **Total for 6 videos × 6 thumbnails**: ~720KB-1.4MB
- **Storage location**: Embedded in Convex `compositionState`
- **Problem**: Hitting Convex 1MB document limit

### After (R2 Storage)
- **Size per thumbnail**: ~50 bytes (URL string)
- **Total for 6 videos × 6 thumbnails**: ~300 bytes
- **Storage location**: R2 bucket, referenced by URL
- **Result**: 99.9% size reduction for thumbnails

## Data Flow

### 1. Thumbnail Generation & Upload

```
┌─────────────────┐
│  Media Upload   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ demux-worker.ts │ ← Generates thumbnails from video
└────────┬────────┘
         │
         │ For each thumbnail:
         │ 1. Convert canvas → JPEG blob
         │ 2. POST to /api/upload-thumbnail
         │
         ▼
┌──────────────────────┐
│/api/upload-thumbnail │ ← Next.js API route
│      route.ts        │
└────────┬─────────────┘
         │
         │ FormData:
         │ - file: Blob
         │ - assetId: string
         │ - index: number
         │
         ▼
┌──────────────────────┐
│ R2 Worker            │
│ /upload-direct       │ ← Cloudflare Worker
└────────┬─────────────┘
         │
         │ R2.put(key, stream)
         │
         ▼
┌──────────────────────┐
│   R2 Bucket          │
│ replicate-videos     │
│                      │
│ thumbnails/          │
│   {assetId}/         │
│     0.jpg            │
│     1.jpg            │
│     ...              │
└──────────────────────┘
```

### 2. Thumbnail Display

```
┌─────────────────────┐
│ Convex Project      │
│ compositionState    │
└────────┬────────────┘
         │
         │ MediaAssetMeta {
         │   thumbnails: [
         │     "https://worker.dev/asset/thumbnails/abc/0.jpg",
         │     "https://worker.dev/asset/thumbnails/abc/1.jpg"
         │   ]
         │ }
         │
         ▼
┌─────────────────────┐
│ ThumbnailInjector   │ ← Applies to timeline
└────────┬────────────┘
         │
         │ CSS: backgroundImage: url(...)
         │
         ▼
┌─────────────────────┐
│ Browser loads       │
│ from R2 via Worker  │
└─────────────────────┘
```

### 3. Thumbnail Cleanup

```
┌─────────────────────┐
│ Delete Media Asset  │
└────────┬────────────┘
         │
         ▼
┌──────────────────────────┐
│ DELETE /api/delete-      │
│   thumbnails?assetId=xxx │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────┐
│ R2 Worker            │
│ /delete-prefix       │
└────────┬─────────────┘
         │
         │ R2.list({ prefix })
         │ R2.delete(keys[])
         │
         ▼
┌──────────────────────┐
│ All thumbnails/      │
│   {assetId}/* files  │
│ removed from R2      │
└──────────────────────┘
```

## File Structure

### Backend

```
app/api/
├── upload-thumbnail/
│   └── route.ts          # Uploads single thumbnail to R2
└── delete-thumbnails/
    └── route.ts          # Deletes all thumbnails for an asset

workers/
└── r2-proxy.ts           # Cloudflare Worker with endpoints:
                          # - POST /upload-direct
                          # - POST /delete-prefix
                          # - GET /asset/{key}

lib/editor/workers/
└── demux-worker.ts       # Generates thumbnails, calls upload API
```

### Configuration

```
wrangler.toml             # R2 bucket binding
.env                      # API keys:
                          # - R2_INGEST_TOKEN
                          # - NEXT_PUBLIC_R2_PROXY_BASE
```

## API Reference

### POST /api/upload-thumbnail

Uploads a single thumbnail to R2.

**Request (FormData)**:
```
file: Blob (JPEG image)
assetId: string
index: number
```

**Response**:
```json
{
  "url": "https://video-editor-proxy.manoscasey.workers.dev/asset/thumbnails%2Fabc123%2F0.jpg"
}
```

### DELETE /api/delete-thumbnails?assetId={id}

Deletes all thumbnails for a given asset.

**Response**:
```json
{
  "ok": true,
  "deleted": 6
}
```

### POST /upload-direct (R2 Worker)

Direct upload endpoint on Cloudflare Worker.

**Request (FormData)**:
```
file: Blob
key: string (e.g., "thumbnails/abc123/0.jpg")
```

**Response**:
```json
{
  "ok": true,
  "key": "thumbnails/abc123/0.jpg"
}
```

### POST /delete-prefix (R2 Worker)

Bulk delete endpoint.

**Request (JSON)**:
```json
{
  "prefix": "thumbnails/abc123/"
}
```

**Response**:
```json
{
  "ok": true,
  "deleted": 6
}
```

### GET /asset/{key} (R2 Worker)

Serves files from R2 with CORS headers.

**Example**:
```
GET /asset/thumbnails%2Fabc123%2F0.jpg
```

**Response**: Binary JPEG data with proper headers

## Key Naming Convention

```
thumbnails/{assetId}/{index}.jpg
```

**Example**:
- `thumbnails/v1-abc123-def456/0.jpg`
- `thumbnails/v1-abc123-def456/1.jpg`
- `thumbnails/v1-abc123-def456/2.jpg`

## Size Comparison

### Before (Base64)
```typescript
{
  thumbnails: [
    "data:image/jpeg;base64,/9j/4AAQSkZJRg...", // ~15KB
    "data:image/jpeg;base64,/9j/4AAQSkZJRg...", // ~15KB
    "data:image/jpeg;base64,/9j/4AAQSkZJRg...", // ~15KB
    // ... 3 more
  ]
}
// Total: ~90KB per asset × 6 assets = ~540KB
```

### After (R2 URLs)
```typescript
{
  thumbnails: [
    "https://video-editor-proxy.manoscasey.workers.dev/asset/thumbnails%2Fabc%2F0.jpg", // ~80 bytes
    "https://video-editor-proxy.manoscasey.workers.dev/asset/thumbnails%2Fabc%2F1.jpg", // ~80 bytes
    "https://video-editor-proxy.manoscasey.workers.dev/asset/thumbnails%2Fabc%2F2.jpg", // ~80 bytes
    // ... 3 more
  ]
}
// Total: ~480 bytes per asset × 6 assets = ~2.9KB
```

**Reduction**: 540KB → 2.9KB = **99.5% smaller**

## Performance Benefits

1. **Document Size**: Convex project documents reduced from ~900KB to ~200KB
2. **Save Operations**: Fewer hitting 80% warning threshold
3. **Network**: Thumbnails load in parallel instead of in single large document
4. **Caching**: R2 URLs can be CDN cached
5. **Scalability**: Can support 100+ videos without document size issues

## Deployment

### 1. Deploy R2 Worker

```bash
npx wrangler deploy workers/r2-proxy.ts
```

### 2. Verify Endpoints

```bash
# Test upload
node scripts/test-thumbnail-upload.js

# Should output:
# ✅ Upload successful
# ✅ Retrieval successful
# ✅ All tests passed!
```

### 3. Set Environment Variables

```bash
# In .env or deployment config
NEXT_PUBLIC_R2_PROXY_BASE=https://video-editor-proxy.manoscasey.workers.dev
R2_INGEST_TOKEN=your-secret-token
```

### 4. Set Worker Secret

```bash
npx wrangler secret put AUTH_TOKEN
# Enter the same token as R2_INGEST_TOKEN
```

## Fallback Behavior

The system includes fallback to base64 if R2 upload fails:

```typescript
try {
  const thumbnailUrl = await uploadThumbnailToR2(blob, assetId, current);
  thumbnails.push(thumbnailUrl);
} catch (error) {
  console.error(`Failed to upload thumbnail:`, error);
  // Fallback to data URL if R2 upload fails
  const dataUrl = await blobToDataUrl(blob);
  thumbnails.push(dataUrl);
}
```

This ensures the editor continues working even if R2 is unavailable.

## Troubleshooting

### Upload fails with 401 Unauthorized

**Solution**: Verify `AUTH_TOKEN` is set in worker and matches `R2_INGEST_TOKEN`:

```bash
npx wrangler secret put AUTH_TOKEN
```

### Thumbnails not displaying

**Checklist**:
1. Verify worker is deployed: `npx wrangler deployments list`
2. Check CORS headers in worker response
3. Verify R2 URLs in browser network tab
4. Check browser console for CORS errors

### Document size still large

**Solution**: Regenerate thumbnails for existing assets or clear old base64 thumbnails:

```typescript
// In asset update logic
if (asset.thumbnails?.[0]?.startsWith('data:')) {
  // Regenerate thumbnails to R2
  void mediaManager.generateThumbnails(asset.id, url, asset.duration, 6);
}
```

## Future Enhancements

1. **Thumbnail Variants**: Generate multiple sizes (timeline, preview, full)
2. **Lazy Loading**: Only load thumbnails when timeline is visible
3. **Preloading**: Prefetch next/previous thumbnails
4. **Compression**: Use WebP for better compression
5. **CDN**: Add Cloudflare CDN caching rules
6. **Cleanup Jobs**: Periodic cleanup of orphaned thumbnails

## Related Files

- `lib/editor/types.ts:136` - MediaAssetMeta type definition
- `lib/editor/workers/messages.ts:53` - Worker message types
- `components/editor/ThumbnailInjector.tsx` - Timeline thumbnail rendering
- `components/editor/StandaloneEditorApp.tsx:283` - Thumbnail generation trigger
- `convex/video.ts:165-186` - Document size monitoring

## Migration Guide

### For Existing Projects

1. Deploy the updated worker
2. New thumbnails will automatically use R2
3. Old base64 thumbnails will continue to work
4. Optionally regenerate all thumbnails:

```typescript
// One-time migration script
for (const asset of project.mediaAssets) {
  if (asset.thumbnails?.[0]?.startsWith('data:')) {
    await regenerateThumbnails(asset.id);
  }
}
```

---

**Last Updated**: 2025-11-22  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
