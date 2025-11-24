# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Video Generation Pipeline is a full-stack AI video creation platform built with Next.js 16, React 19, and TypeScript. The application features a multi-phase workflow (Input → Storyboard → Generation → Editor) where users create AI-generated videos from text prompts, powered by Convex for real-time data, Clerk for auth, and an advanced video editor with WebCodecs/WebGPU rendering.

## Essential Commands

**Development:**
```bash
bun run dev                # Start Next.js (Turbopack) + Convex concurrently
bun run dev:next           # Start Next.js development server only
bun run dev:convex         # Start Convex backend only
bun run build              # Build Next.js application
bun run start              # Start production server
```

**Type Checking:**
```bash
bunx tsc --noEmit          # Type-check without emitting files
```

**Worker Deployment:**
```bash
# Deploy R2 proxy worker (from workers/)
wrangler publish           # Deploy to Cloudflare Workers
```

## Architecture Overview

### Tech Stack
- **Next.js 16** with Turbopack for fast builds
- **React 19.2.0** with latest concurrent features
- **Convex** for real-time backend (12 tables, mutations/queries)
- **Clerk** for authentication
- **Cloudflare R2** for zero-egress media storage via proxy worker
- **Tailwind CSS 4** + **shadcn/ui** + **Radix UI** for UI
- **MediaBunny** + **Twick SDK** for video editing
- **WebCodecs** + **WebGPU** for preview/export rendering
- **Zustand** for client-side state management

### Key Integration: OpenCut Editor
This project embeds components from `external/OpenCut` (a separate git submodule). The OpenCut editor provides the timeline UI, media panel, and preview panel. Webpack/Turbopack aliases in `next.config.ts` map `@/components/editor/*` and `@/stores/*` to OpenCut's source files.

**Important:** When working with editor components, be aware that some files live in `external/OpenCut/apps/web/src/` rather than the main codebase.

### Project Structure

```
/
├── app/                          # Next.js 16 app router
│   ├── [projectId]/              # Dynamic project routes
│   │   ├── prompt/               # Clarifying questions phase
│   │   ├── character-select/     # Character selection
│   │   ├── storyboard/           # Scene editing
│   │   ├── video/                # Video generation
│   │   └── editor/               # Timeline editor
│   ├── api/                      # 22 API routes (22 total)
│   │   ├── replicate/            # Replicate polling/webhooks
│   │   ├── generate-*/           # AI generation endpoints
│   │   └── convex/               # Convex webhooks
│   ├── home/                     # Landing page
│   ├── projects/                 # Project list
│   └── layout.tsx                # Root layout with providers
│
├── components/                   # React UI components
│   ├── ui/                       # shadcn/ui components
│   ├── editor/                   # Editor-specific components
│   ├── storyboard/               # Storyboard phase UI
│   ├── input-phase/              # Input wizard components
│   └── redesign/                 # New workflow UI
│
├── convex/                       # Convex backend
│   ├── schema.ts                 # 12 database tables
│   ├── video.ts                  # Video project CRUD (54KB)
│   ├── editor.ts                 # Editor state persistence
│   ├── beatAnalysis.ts           # Audio beat detection (32KB)
│   ├── editorAssets.ts           # Asset management
│   └── auth.config.ts            # Clerk integration
│
├── lib/                          # Core business logic
│   ├── editor/                   # Video editor orchestration
│   │   ├── core/
│   │   │   ├── project-store.ts  # Zustand store + Convex sync
│   │   │   ├── timeline-service.ts
│   │   │   └── persistence.ts
│   │   ├── playback/
│   │   │   ├── playback-controller.ts
│   │   │   ├── preview-renderer.ts  # Canvas + AudioWorklet
│   │   │   └── video-loader.ts      # WebCodecs demux
│   │   ├── export/
│   │   │   └── export-pipeline.ts   # Export orchestration
│   │   ├── workers/
│   │   │   ├── demux-worker.ts      # MediaBunny demux
│   │   │   ├── encode-worker.ts     # WebCodecs encode + mux
│   │   │   └── messages.ts
│   │   ├── audio/
│   │   │   └── audio-mixer.ts       # Stereo 48kHz mixing
│   │   ├── io/
│   │   │   └── media-bunny-manager.ts  # Media ingest
│   │   ├── effects/               # Video effects
│   │   ├── transitions/           # Transitions
│   │   ├── filters/               # Filters
│   │   └── twick-adapter.ts       # Map state to Twick SDK
│   ├── opencut/                  # OpenCut integration layer
│   ├── adapters/                 # Audio/voice adapters
│   ├── image-models.ts           # Text-to-image configs
│   ├── audio-models.ts           # Audio model configs
│   ├── prompts.ts                # Prompt templates
│   └── utils.ts
│
├── workers/
│   └── r2-proxy.ts               # Cloudflare Worker for R2 assets
│
├── external/OpenCut/             # Git submodule (separate repo)
│   └── apps/web/src/
│       ├── components/editor/    # Timeline UI, media panel, etc.
│       └── stores/               # Zustand stores
│
└── public/                       # Static assets
```

## Core Workflow & Data Flow

### Multi-Phase Video Creation
1. **Input Phase** (`/input`): User provides prompt, audience, tone, duration, style → `convex/video.ts:createProject`
2. **Storyboard Phase** (`/[projectId]/storyboard`): AI generates scenes → user reviews/edits → `convex/video.ts:updateScene`
3. **Generation Phase** (`/[projectId]/video`): Replicate generates video clips → polling via `/api/replicate/poll` → stores in Convex `videoClips` table
4. **Editor Phase** (`/[projectId]/editor`): Timeline editing → `lib/editor/core/project-store.ts` syncs to Convex → export via `lib/editor/export/export-pipeline.ts`

### Media Storage Pipeline (R2 + Proxy)
- **Replicate outputs** are ingested to R2 via `workers/r2-proxy.ts` ingest endpoint
- **Assets** store `r2Key`, `proxyUrl`, `sourceUrl` in Convex
- **Playback** prefers `proxyUrl` (low-res proxy) for smooth scrubbing
- **Export** uses original `r2Key`/`sourceUrl` for full quality
- **Zero egress**: All media served through Cloudflare Worker with Range request support

### Editor State Management
- **Zustand store** (`lib/editor/core/project-store.ts`): Timeline tracks, elements, playback state
- **Convex sync** (`lib/editor/convex-adapter.ts`): Debounced saves via `video.saveProject`
- **Hydration** (`lib/editor/hooks/useConvexProjectSync.ts`): Loads state from Convex on mount
- **Undo/redo**: Persisted in Convex for cloud-based history

### WebCodecs Playback & Export
- **Demux worker** (`lib/editor/workers/demux-worker.ts`): MediaBunny decodes assets in dedicated worker
- **Preview renderer** (`lib/editor/playback/preview-renderer.ts`): WebGPU canvas with audio-driven clock, dual VideoTextures, crossfade shader
- **Export worker** (`lib/editor/workers/encode-worker.ts`): Decodes full-res assets, composites timeline, mixes audio to stereo 48kHz, muxes MP4
- **Frame caching**: Preview uses frame cache for smooth scrubbing

## Development Patterns

### React Code Style (from CLAUDE.md)
**Inline callbacks over named handlers:**
```tsx
// ✅ Good: Inline with descriptive function calls
<button onClick={() => {
  analytics.event('export-clicked')
  startExport()
}}>

// ❌ Bad: Named handler loses context
<button onClick={handleClick}>
```

**Avoid over-memoization:**
- Only memoize props passed to components with expensive children
- Leaf components can over-render (it's fine!)
- `useMemo` doesn't fix bugs, it makes them happen less often

**Accessibility:**
- Never use `<div onClick>` — use `<button>` for interactive elements

### State Management
- **Zustand** for editor state (timeline, playback, project)
- **Convex** for persistent data (projects, scenes, clips, assets)
- **Debounced sync**: `useConvexProjectSync` saves editor state to Convex every 2 seconds

### Media Processing
- **Always use workers** for heavy processing (demux, encode, effects)
- **Reuse `mediaBunnyManager`** instead of touching `demux-worker` directly
- **Prefer proxy URLs** for playback, original URLs for export

### Environment Variables
See `.env.example` for all required/optional keys:
- **Convex**: `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`
- **Clerk**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- **R2**: `NEXT_PUBLIC_R2_PROXY_BASE`, `R2_INGEST_URL`, `R2_INGEST_TOKEN`
- **AI providers**: `ANTHROPIC_API_KEY`, `REPLICATE_API_KEY`, `ELEVENLABS_API_KEY`, etc.

## TypeScript Path Aliases

Configured in `tsconfig.json`:
- `@/*` → root + `external/OpenCut/apps/web/src/*`
- `@opencut/*` → `external/OpenCut/apps/web/src/*`
- `@opencut/lib/storage/storage-service` → `lib/opencut/storage-service.ts`

**Important:** Some editor components resolve to OpenCut's source via webpack/turbopack aliases in `next.config.ts`.

## Common Gotchas

### COOP/COEP Headers
`next.config.ts` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` on all routes to enable SharedArrayBuffer/WebCodecs. Third-party media (Replicate, R2) loads without CORP headers due to `credentialless` mode.

### External Directory
`next.config.ts` sets `experimental.externalDir: true` to allow importing from `external/OpenCut` without Next.js refusing to bundle it.

### Parallel Dev Servers
`next.config.ts` sets `experimental.lockDistDir: false` to allow multiple dev servers (Next.js + Convex) without lock conflicts.

### Font Loading
The app uses system sans-serif stack (no `next/font` Google fonts) for offline-friendly builds.

### 4K Proxy Workflow
Assets can provide both `proxyUrl`/`proxyR2Key` (low-res) and `r2Key`/`sourceUrl` (full-res). Playback uses proxy for smooth scrubbing; export uses original for full quality.

## Linear Workflow

- **Always link to a Linear issue** before starting work
- **Update Linear status** after each GitHub push
- **Add comments** to Linear issues summarizing changes and linking to commits/PRs

## Code Style

- **Arrow functions only** in TypeScript
- **Prefer Tailwind** over custom CSS
- **Use shadcn/ui** components where possible
- **Start simple**: Only add complexity when necessary
- **Avoid excessive types**: Don't create interfaces/types unless they provide clear value
- **Use Bun** for all Node.js commands (scripts, package installation)

## Resources

- **README.md**: Detailed setup, R2 proxy deployment, recent handoff notes
- **ARCHITECTURE.md**: Full tech stack, API routes, workflow versions, cost estimation
- **convex/README.md**: Convex function documentation
- **docs/**: Additional documentation on specific features
