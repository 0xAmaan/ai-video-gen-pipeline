# Cloudflare R2 Proxy & Ingest Worker

This worker implements the storage pieces called out in `docs/PRDs/VideoEditorPRD.md`: secure range-aware delivery from R2 and streaming ingest from Replicate (or any signed URL) without buffering 4K files in memory.

## File
- `workers/r2-proxy.ts`

## Routes
- `GET /asset/:key` — Streams objects from `R2_BUCKET` with **HTTP 206 Range Request support** for efficient 4K video seeking. When a `Range: bytes=...` header is present, the worker passes it to R2 and returns a `206 Partial Content` response with the appropriate `Content-Range` header. This is critical for MediaBunny/WebCodecs to perform frame-accurate seeking without downloading entire files. Full objects return `200 OK` when no range is requested.
- `POST /ingest` — Body: `{ "sourceUrl": "https://...", "key": "path/in/r2.mp4" }`. Streams the upstream response into R2 using `objectSize` to avoid buffering. Rejects if `Content-Length` is missing. Requires auth when `AUTH_TOKEN` is configured.
- `OPTIONS` — CORS preflight.

## Env bindings
- `R2_BUCKET` — R2 bucket binding.
- `AUTH_TOKEN` — Optional bearer token required for `/ingest`. When omitted, the endpoint is open (useful for local dev).
- `ALLOWED_ORIGINS` — Optional comma-separated origins for CORS (defaults to `*`).

## Wrangler example
```toml
name = "video-editor-proxy"
main = "workers/r2-proxy.ts"
compatibility_date = "2024-11-07"

[vars]
AUTH_TOKEN = "dev-token"
ALLOWED_ORIGINS = "http://localhost:3000"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "video-editor"
```

Deploy with `wrangler publish`. The Next.js app should fetch media through this worker URL. (If you need range requests again, re-enable in the worker and confirm Cloudflare returns `206` rather than rewriting to `200` with `Content-Range`.)

## Frontend wiring
- Set `NEXT_PUBLIC_R2_PROXY_BASE` to the worker origin (no trailing slash, e.g., `https://video-editor-proxy.example.workers.dev`). `lib/editor/io/asset-url.ts` uses this to build `/asset/:key` URLs.
- Convex now exposes `convex/assets.ts` with `registerAsset`, `upsertByPrediction`, and `listAssets` to store R2 keys + proxy URLs alongside project IDs.
- Server-side polling (`app/api/poll-prediction/route.ts`) will attempt to POST to `/ingest` when env vars `R2_INGEST_URL` (or fallback `NEXT_PUBLIC_R2_PROXY_BASE`) and optional `R2_INGEST_TOKEN` are set. Successful ingests respond with `proxyUrl`/`r2Key` so the client uses the R2-hosted asset instead of the transient Replicate URL.
- Clip metadata now tracks `r2Key`/`proxyUrl` in Convex (`videoClips` table) via `updateVideoClip`, and the client poller stores those fields when present.
