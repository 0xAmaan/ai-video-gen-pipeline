# AI Video Generation Pipeline

Create AI-generated videos through a multi-phase workflow: **Input** → **Storyboard** → **Generation** → **Editor**. Built with Next.js 16, React 19, Convex, and a WebCodecs-powered timeline editor.

## Features

- 🎬 **Four-stage workflow**: Prompt → AI storyboard → Video generation → Timeline editing
- 🎨 **Advanced editor**: WebGPU preview, multi-track timeline, effects, transitions
- ☁️ **Cloud sync**: Real-time Convex backend with undo/redo persistence
- 🚀 **Zero-egress media**: Cloudflare R2 + proxy worker for cost-effective storage
- 🎵 **Audio mixing**: Stereo 48kHz mixing with beat detection
- 📦 **Export**: WebCodecs encoding with MP4 muxing

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) 1.1+
- Node.js 18+

### Installation

```bash
bun install
```

### Development

```bash
bun run dev          # Start Next.js + Convex
bun run dev:next     # Next.js only
bun run dev:convex   # Convex only
bun run build        # Production build
```

Visit `http://localhost:3000`, sign in with Clerk, and create a new project at `/new`.

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

**Required:**
- `CONVEX_DEPLOYMENT` / `NEXT_PUBLIC_CONVEX_URL` - Convex backend
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` - Authentication
- `ANTHROPIC_API_KEY` - AI storyboard generation
- `REPLICATE_API_KEY` - Video/voice generation

**Optional:**
- `NEXT_PUBLIC_R2_PROXY_BASE` - Cloudflare R2 proxy URL
- `R2_INGEST_URL` / `R2_INGEST_TOKEN` - R2 ingest endpoint
- `ELEVENLABS_API_KEY` - ElevenLabs voice models

See `.env.example` for full list.

## Architecture Highlights

### Multi-Phase Workflow

1. **Input**: Specify prompt, audience, tone, duration, style
2. **Storyboard**: AI generates scenes, user reviews/edits
3. **Generation**: Replicate generates video clips, stores in R2
4. **Editor**: Timeline editing with WebCodecs playback/export

### Editor Stack

- **State**: Zustand store synced to Convex every 2s
- **Playback**: WebGPU canvas + AudioWorklet with frame caching
- **Media**: MediaBunny demux worker for multi-format support
- **Export**: WebCodecs encode worker with stereo audio mixing
- **UI**: Twick SDK timeline integrated via `lib/editor/twick-adapter.ts`

### Media Pipeline

Assets are stored with dual-quality support:
- **Proxy** (`proxyUrl`): Low-res for smooth playback/scrubbing
- **Original** (`r2Key`/`sourceUrl`): Full-res for export

The R2 proxy worker (`workers/r2-proxy.ts`) handles Range requests and zero-egress streaming.

## R2 Proxy Deployment

Deploy the Cloudflare Worker for media storage:

```bash
cd workers
wrangler publish
```

Configure environment:
```bash
NEXT_PUBLIC_R2_PROXY_BASE="https://video-editor-proxy.example.workers.dev"
R2_INGEST_URL="https://video-editor-proxy.example.workers.dev/ingest"
R2_INGEST_TOKEN="your-secret-token"
```

The worker provides:
- `/asset/:key` - Range-enabled asset streaming
- `/ingest` - Upload endpoint with bearer auth

## Key Directories

```
lib/editor/
├── core/              # Zustand store, timeline service, persistence
├── playback/          # WebGPU renderer, video loader, playback control
├── export/            # Export pipeline orchestration
├── workers/           # Demux + encode workers
├── audio/             # Audio mixer, beat detection
└── io/                # MediaBunny manager

convex/
├── video.ts           # Project CRUD, scenes, clips
├── editor.ts          # Editor state persistence
├── beatAnalysis.ts    # Audio beat detection
└── schema.ts          # Database schema (12 tables)

app/
├── [projectId]/       # Dynamic project routes
│   ├── storyboard/    # Scene editing phase
│   ├── video/         # Generation phase
│   └── editor/        # Timeline editor
└── api/               # API routes (22 total)
```

## Tech Stack

- **Framework**: Next.js 16 (Turbopack), React 19
- **Backend**: Convex (real-time database)
- **Auth**: Clerk
- **Storage**: Cloudflare R2 + Workers
- **UI**: Tailwind CSS 4, shadcn/ui, Radix UI
- **Video**: WebCodecs, WebGPU, MediaBunny, Twick SDK
- **State**: Zustand
- **AI**: Anthropic, Replicate, ElevenLabs

## Development Notes

- **COOP/COEP headers** enabled in `next.config.ts` for SharedArrayBuffer/WebCodecs
- **OpenCut integration**: `external/OpenCut` git submodule provides timeline UI components
- **Offline builds**: Uses system fonts (no Google Fonts) for offline-friendly builds
- **Type checking**: Run `bunx tsc --noEmit` before committing

## Documentation

- `CLAUDE.md` - Developer guide for Claude Code
- `ARCHITECTURE.md` - Detailed tech stack and patterns
- `convex/README.md` - Convex function documentation
- `docs/` - Feature-specific documentation

## License

See `LICENSE` file for details.
