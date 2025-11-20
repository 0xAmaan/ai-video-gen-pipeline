# AI Video Gen Pipeline

AI Video Generation Pipeline is a modern web application built with Next.js 16, React 19, and TypeScript that enables users to create AI-generated videos through an intuitive multi-phase workflow. The application features a four-stage pipeline (Input, Storyboard, Generation, and Editor) where users can specify their video requirements including prompt, target audience, tone, duration, and style, then review AI-generated storyboards before final video generation. Built with Convex for real-time data management, Clerk for authentication, and Tailwind CSS with Radix UI components for a polished user interface, the platform provides a seamless experience from concept to final video export with built-in editing capabilities..

## Prerequisites

- [Bun](https://bun.sh/) 1.1+
- Node.js 18+
- [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) (latest)

Install and activate Emscripten once per machine:

```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

Confirm `em++` is available before compiling the timeline engine.

## Installing dependencies

```bash
bun install
```

This installs the Next.js UI, Convex functions, MediaBunny ingest stack, and the editor orchestration layer under `lib/editor`.

## Building the WebAssembly timeline engine

The CapCut-style timeline engine lives under `engine/cpp`. It includes timeline math, effects, compositor bindings, and Emscripten glue. Generate the WASM bundle consumed by the workers + orchestration layer with:

```bash
./engine/build.sh
```

This script wraps `em++` with the SIMD/webworker-friendly flags described in `docs/PRDs/CapCut_Style_Editor_Implementation_Guide.md` §7 and emits `public/wasm/timeline-engine.{js,wasm}`. The JS glue is loaded at runtime via `lib/editor/core/timeline-service.ts` using an ES module import with `webpackIgnore` so you always pull the latest asset from `/public`.

When iterating on the engine:

1. Update the C++ sources in `engine/cpp/**`.
2. Re-run `./engine/build.sh` to rebuild the WASM bundle.
3. Restart `bun run dev` if the dev server cached the previous artifacts.

## Running the full stack

```bash
bun run dev
```

The command above launches Next.js (Turbopack) and Convex simultaneously. Sign in with Clerk, walk through `/create`, and the onboarding flow redirects you to `/editor` which mounts the full CapCut-class experience backed by:

- `lib/editor/core/project-store.ts`: Zustand store + IndexedDB persistence + timeline/WASM bindings.
- `lib/editor/io/media-bunny-manager.ts`: Media ingest that streams File objects through the demux worker + MediaBunny.
- `lib/editor/workers/*.ts`: Dedicated workers for demux, effects stubs, and export encoding.
- `lib/editor/playback/preview-renderer.ts`: Canvas + AudioWorklet preview pipeline with frame caching.
- `lib/editor/export/export-pipeline.ts`: Encode worker orchestration and File System Access API save helper.

## Regenerating assets

- **Timeline engine**: `./engine/build.sh`
- **WASM glue location**: `public/wasm/timeline-engine.{js,wasm}` (served at `/wasm/*`). Update the bundle whenever you touch `engine/cpp/**`.
- **Audio worklet**: `public/audio/preview-processor.js` is a plain JS module that can be tweaked without rebuilding.
- **Workers**: TypeScript worker entry points under `lib/editor/workers` are compiled by Next automatically; update and restart dev server if needed.

## Media storage (R2 proxy)

- Deploy `workers/r2-proxy.ts` as a Cloudflare Worker (see `docs/r2-proxy-worker.md`) to stream Range-enabled assets from R2 and to ingest Replicate outputs without buffering.
- Set `NEXT_PUBLIC_R2_PROXY_BASE` in your environment to the worker origin (e.g., `https://video-editor-proxy.example.workers.dev`). Media URLs built from R2 keys will use `/asset/:key`; uploads can hit `/ingest` with `Authorization: Bearer <AUTH_TOKEN>` when configured.
- The Replicate polling route optionally ingests finished clips directly into R2 when `R2_INGEST_URL` (or fallback `NEXT_PUBLIC_R2_PROXY_BASE`) is set, plus optional `R2_INGEST_TOKEN` for auth. On success it returns `proxyUrl`/`r2Key` so the editor consumes the R2-hosted asset.
- Convex `videoClips` now store `r2Key`/`proxyUrl`/`sourceUrl` so downstream editors can load via the R2 worker instead of transient Replicate URLs.

## Notes

- MediaBunny lives entirely in the demux worker to keep the main thread responsive. Reuse `mediaBunnyManager` rather than touching the worker directly.
- The editor state, media catalog, and undo/redo stacks persist inside IndexedDB (`capcut-editor` DB). If you need a clean slate, clear the browser storage.
- The export pipeline currently writes a placeholder blob via the encode worker. Replace the logic inside `lib/editor/workers/encode-worker.ts` with a real WebCodecs muxer when you're ready.
