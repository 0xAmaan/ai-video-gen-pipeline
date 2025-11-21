# AI Video Gen Pipeline

AI Video Generation Pipeline is a modern web application built with Next.js 16, React 19, and TypeScript that enables users to create AI-generated videos through an intuitive multi-phase workflow. The application features a four-stage pipeline (Input, Storyboard, Generation, and Editor) where users can specify their video requirements including prompt, target audience, tone, duration, and style, then review AI-generated storyboards before final video generation. Built with Convex for real-time data management, Clerk for authentication, and Tailwind CSS with Radix UI components for a polished user interface, the platform provides a seamless experience from concept to final video export with built-in editing capabilities.

## Prerequisites

- [Bun](https://bun.sh/) 1.1+
- Node.js 18+

## Installing dependencies

```bash
bun install
```

This installs the Next.js UI, Convex functions, MediaBunny ingest stack, and the editor orchestration layer under `lib/editor`.

## Running the full stack

```bash
bun run dev
```

The command above launches Next.js (Turbopack) and Convex simultaneously. Sign in with Clerk, create a new project via `/new`, and walk through the multi-phase workflow (prompt → storyboard → video → editor) backed by:

- `lib/editor/core/project-store.ts`: Zustand store + Convex persistence for timeline state
- `lib/editor/io/media-bunny-manager.ts`: Media ingest that streams File objects through the demux worker + MediaBunny
- `lib/editor/workers/*.ts`: Dedicated workers for demux, effects stubs, and export encoding
- `lib/editor/playback/preview-renderer.ts`: Canvas + AudioWorklet preview pipeline with frame caching
- `lib/editor/export/export-pipeline.ts`: Encode worker orchestration and File System Access API save helper

## Media storage (R2 proxy)

- Deploy `workers/r2-proxy.ts` as a Cloudflare Worker (see `docs/r2-proxy-worker.md`) to stream Range-enabled assets from R2 and to ingest Replicate outputs without buffering.
- Set `NEXT_PUBLIC_R2_PROXY_BASE` in your environment to the worker origin (e.g., `https://video-editor-proxy.example.workers.dev`). Media URLs built from R2 keys will use `/asset/:key`; uploads can hit `/ingest` with `Authorization: Bearer <AUTH_TOKEN>` when configured.
- The Replicate polling route optionally ingests finished clips directly into R2 when `R2_INGEST_URL` (or fallback `NEXT_PUBLIC_R2_PROXY_BASE`) is set, plus optional `R2_INGEST_TOKEN` for auth. On success it returns `proxyUrl`/`r2Key` so the editor consumes the R2-hosted asset.
- Convex `videoClips` now store `r2Key`/`proxyUrl`/`sourceUrl` so downstream editors can load via the R2 worker instead of transient Replicate URLs.

## Recent implementation notes (handoff)

- **Core deps**: Added Twick SDKs, Three/WebGPU, Pixi, Three typings. COOP/COEP headers in `next.config.ts`. `.env.example` updated with Convex/Clerk/R2 keys.
- **Convex bridge**: New `video.saveProject`/`loadProjectState` to persist editor composition state; client hook `useConvexProjectSync` debounces Zustand → Convex saves and hydrates on load.
- **Playback**: `VideoLoader` uses WebCodecs + MediaBunny demux; WebGPU preview renderer uses audio-driven clock, dual VideoTextures, and a simple crossfade shader.
- **Timeline UI**: Swapped custom timeline for Twick `VideoEditor` inside `TimelineProvider`/`LivePlayerProvider`, mapped via `lib/editor/twick-adapter.ts`.
- **Export (video + audio)**: Worker (`lib/editor/workers/encode-worker.ts`) now decodes real video/image assets via WebCodecs + MediaBunny and composites timeline tracks; audio clips are decoded/mixed to stereo 48kHz and muxed alongside video via `CanvasSource`/`Mp4OutputFormat`. ExportPipeline passes full project/sequence + aspectRatio.
- **Build**: Turbopack root pinned to this workspace; `bun run build` now succeeds (uses `next/font/google` Inter, so outbound network to fonts.googleapis.com is required) and TypeScript includes auto-added `.next` typings.
- **Upstream alignment**: Convex now exposes voice settings, audio asset CRUD, phase reset/model selection, lip-sync helpers, and project delete/title mutations so upstream pipeline routes work unchanged while the Twick/WebGPU editor stays in place. Legacy editor files were removed upstream; timeline state now stubs persistence/timeline-service locally to keep the new editor compiling.
- **Editor persistence**: Added Convex-backed save/load (`saveEditorState`/`loadEditorState`) with bounded cloud history plus localStorage fallback. Client calls go through `/api/editor-state`; the editor store can hydrate by `projectId` for multi-device sync.

## R2 / proxy setup (zero-egress media pipeline)

Env vars (set in `.env.local` and hosting):
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN` (R2 read/write + Workers deploy)
- `R2_BUCKET_NAME`
- `NEXT_PUBLIC_R2_PROXY_BASE` (Worker URL, e.g. `https://video-editor-proxy.example.workers.dev`)
- `R2_INGEST_URL` (same as proxy or dedicated ingest route)
- `R2_INGEST_TOKEN` (shared secret checked by the Worker)

Deploy `workers/r2-proxy.ts` with `wrangler publish`; ensure it supports Range requests and checks `R2_INGEST_TOKEN` for ingest. MediaBunny/Twick should reference `proxyUrl`/`r2Key` fields from Convex so playback/export stays zero-egress. Prefer direct Replicate→R2 writes when models support S3 outputs; otherwise stream via the Worker using `fetch` → `R2Bucket.put` with a known `Content-Length`.

## Notes

- MediaBunny lives entirely in the demux worker to keep the main thread responsive. Reuse `mediaBunnyManager` rather than touching the worker directly.
- The editor state, media catalog, and undo/redo stacks are persisted to Convex for cloud sync and undo/redo functionality.
- The export pipeline currently writes a placeholder blob via the encode worker. A full WebCodecs muxer implementation is planned.
