# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Video Generation Pipeline: A multi-phase web application that transforms user prompts into AI-generated videos through a workflow of prompt refinement → storyboard generation → video synthesis → timeline editing.

**Stack**: Next.js 16 (React 19) + Convex (real-time DB) + Clerk (auth) + OpenAI GPT-4 + Replicate (Flux Schnell for images, WAN 2.5 for i2v)

**Key Pattern**: Serverless real-time architecture with client-side Zustand state, Convex for backend mutations/queries, and API routes orchestrating AI provider calls.

## Development Commands

**Start Development** (runs both Next.js and Convex):
```bash
bun run dev
```

This uses `concurrently` to run:
- Next.js dev server with Turbopack: `bun run dev:next`
- Convex backend: `bun run dev:convex`

**Build & Deploy**:
```bash
bun run build      # Production Next.js build
bun run start      # Start production server
```

**Note**: Development server is typically already running. Avoid running `bun dev` unless explicitly needed.

## Architecture Overview

### Multi-Phase Workflow

1. **Input Phase** (`/[projectId]/prompt`)
   - User provides initial prompt
   - AI generates 3-5 clarifying questions via `/api/generate-questions` (GPT-4)
   - User answers questions to refine vision
   - Includes "image-generation-priority" question that determines model selection

2. **Storyboard Phase** (`/[projectId]/storyboard`)
   - AI generates scene descriptions + images via `/api/generate-storyboard` (GPT-4 + Flux Schnell)
   - User can edit scenes, adjust durations, regenerate images
   - Drag-drop reordering supported
   - Scene regeneration via `/api/regenerate-scene`

3. **Character Selection Phase** (`/[projectId]/character-select`)
   - AI generates character variations
   - User selects preferred character design
   - Character reference used throughout video

4. **Video Generation Phase** (`/[projectId]/video`)
   - Parallel video clip generation via `/api/generate-all-clips` (Replicate WAN 2.5)
   - Real-time progress tracking with polling (`/api/poll-prediction`)
   - Voice narration generation and lip-sync processing
   - Handles prediction cancellation via `/api/cancel-prediction`

5. **Editor Phase** (`/[projectId]/editor`)
   - CapCut-style timeline editor (Konva-based)
   - Multi-track editing (video, audio, overlay, fx)
   - WebAssembly timeline engine (planned, not yet implemented)
   - Export functionality (basic)

### Convex Database Schema

**Core Collections**:
- `videoProjects`: Main project metadata (userId, prompt, status, lastActivePhase)
- `clarifyingQuestions`: Generated questions and user answers
- `scenes`: Storyboard scenes (description, visualPrompt, imageUrl, narrationUrl, lipsyncVideoUrl)
- `videoClips`: Generated video clips with Replicate prediction tracking
- `projectVoiceSettings`: Voice configuration (MiniMax voice IDs, emotion, speed, pitch)
- `editorProjects`: Konva timeline editor projects
- `projectHistory`: Undo/redo snapshots (separated to avoid document size limits)

**Status Flow**:
```
draft → questions_generated → questions_answered → character_selected →
generating_storyboard → storyboard_created → video_generated
```

### Key Libraries & Integrations

**Frontend**:
- `zustand`: Client-side state management (editor project store)
- `react-konva` + `konva`: Canvas-based timeline editor
- `shadcn/ui` + Radix UI: Component library
- Tailwind CSS 4: Styling (with tw-animate-css)

**Backend & AI**:
- `convex`: Real-time database + serverless functions (auth via Clerk)
- `openai` (via `@ai-sdk/openai`): GPT-4 for text generation
- `replicate`: Image (Flux Schnell) and video (WAN 2.5) generation
- `mediabunny`: Media processing pipeline (demux, waveform, thumbnails)

**Auth**: Clerk with JWT template for Convex integration

### Important File Locations

**API Routes** (`app/api/`):
- `generate-questions/route.ts`: Question generation (GPT-4)
- `generate-storyboard/route.ts`: Scene descriptions + images
- `generate-all-clips/route.ts`: Batch video generation
- `poll-prediction/route.ts`: Check Replicate prediction status
- `cancel-prediction/route.ts`: Cancel running predictions
- `generate-voice-selection/route.ts`: AI voice selection
- `generate-scene-narration/route.ts`: Narration generation
- `lipsync-video/route.ts`: Lip-sync processing
- `poll-lipsync/route.ts`: Check lip-sync status

**Convex Functions** (`convex/`):
- `video.ts`: All video project mutations/queries (createProject, saveQuestions, saveScenes, updateVideoClip, etc.)
- `editor.ts`: Editor project persistence (saveEditorProject, loadEditorProject, saveHistorySnapshot)
- `schema.ts`: Database schema definitions

**Core Libraries** (`lib/`):
- `prompts.ts`: Unified AI prompt templates (question generation, storyboard, narration)
- `server/convex.ts`: Server-side authenticated Convex client factory
- `server/voice-selection.ts`: Voice selection logic
- `server/lipsync.ts`: Lip-sync processing utilities
- `replicate.ts`: Replicate response parsing utilities
- `image-models.ts`: Image model configuration (Flux Schnell, Flux Dev, SDXL, etc.)
- `select-image-model.ts`: Model selection based on user priorities
- `demo-mode.ts`: Development mode configuration (off/no-cost/cheap/real)
- `demo-mocks/`: Mock data for no-cost demo mode
- `flow-tracker.ts`: Flow event tracking for analytics

**Editor Architecture** (`lib/editor/`):
- `core/project-store.ts`: Zustand store with Convex persistence + undo/redo
- `types.ts`: TypeScript definitions (Project, Sequence, Track, Clip, Effect, etc.)
- `io/media-bunny-manager.ts`: MediaBunny integration for media ingest
- `playback/preview-renderer.ts`: Canvas + AudioWorklet playback
- `playback/frame-cache.ts`: Frame caching for scrubbing
- `export/export-pipeline.ts`: Export orchestration
- `workers/demux-worker.ts`: Web Worker for media demuxing
- `convex-adapter.ts`: Bridge between Zustand and Convex

**Components** (`components/`):
- Phase components: `InputPhase.tsx`, `StoryboardPhase.tsx`, `VideoGeneratingPhase.tsx`
- Editor components: `editor/KonvaTimeline.tsx`, `editor/PreviewPanel.tsx`, `editor/MediaPanel.tsx`
- UI components: `ui/` (shadcn/ui components)

### Demo Mode System

Three development modes (configured in `lib/demo-mode.ts`):
1. **OFF**: Normal production behavior
2. **NO_COST**: Mock all API calls with instant responses (uses `lib/demo-mocks/`)
3. **CHEAP**: Use cheapest/fastest models for real inference
4. **REAL**: Production-quality models (default)

Toggle via `DemoModeToggle` component. State persists in localStorage (client-side only).

## Common Development Patterns

### Client-Side Fetch Pattern ⚠️ IMPORTANT

**ALWAYS use `apiFetch()` or `apiFetchJSON()` for API calls (never raw `fetch()`):**

```typescript
// ✅ CORRECT - Auto-handles demo mode header + flow event import
import { apiFetch, apiFetchJSON } from "@/lib/api-fetch";

const data = await apiFetchJSON("/api/endpoint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ... }),
});
// Flow events automatically imported, demo mode header automatically added
```

```typescript
// ❌ WRONG - Manual fetch bypasses automatic features
const response = await fetch("/api/endpoint", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-demo-mode": getDemoMode(), // Manual (error-prone)
  },
  body: JSON.stringify({ ... }),
});
const data = await response.json();
// Flow events NOT imported, fragile demo mode handling
```

**Why this matters:**
- `apiFetch` automatically injects `x-demo-mode` header from localStorage
- `apiFetch` automatically imports flow events from API responses
- Prevents bugs where demo mode doesn't work or flow UI doesn't update

### API Route Pattern ⚠️ IMPORTANT

**ALL API routes must use `apiResponse()` and `apiError()` wrappers:**

```typescript
// ✅ CORRECT - Auto-appends flow events + consistent error handling
import { apiResponse, apiError } from "@/lib/api-response";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  const demoMode = getDemoModeFromHeaders(req.headers);

  try {
    const { data } = await req.json();

    flowTracker.trackAPICall("POST", "/api/endpoint", { data, demoMode });

    // Demo mode check (if route makes external API calls)
    if (demoMode === "no-cost") {
      flowTracker.trackDecision("Check demo mode", "no-cost", "Using mock data");
      await mockDelay(200);
      return apiResponse({ success: true, result: mockData() });
    }

    const result = await externalAPICall(data);
    return apiResponse({ success: true, result });
  } catch (error) {
    return apiError("Failed to process", 500, error.message);
  }
}
```

```typescript
// ❌ WRONG - Manual flow events (error-prone)
export async function POST(req: Request) {
  try {
    const { data } = await req.json();
    const result = await externalAPICall(data);

    return NextResponse.json({
      success: true,
      result,
      _flowEvents: flowTracker.getEvents(), // Easy to forget
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
```

### Making Convex Calls from API Routes

API routes need authenticated Convex clients:
```typescript
import { getConvexClient } from "@/lib/server/convex";

const client = await getConvexClient(); // Auto-authenticates with Clerk
await client.mutation(api.video.updateScene, { ... });
```

### AI Provider Orchestration

All AI calls go through API routes (not directly from client):
1. Client triggers via `apiFetch()` to `/api/*` (NOT raw `fetch()`)
2. API route authenticates user (Clerk)
3. API route calls AI provider (OpenAI, Replicate)
4. API route saves results to Convex
5. Convex auto-syncs to client (reactive queries)

### Replicate Polling Pattern

Video generation is async with polling:
1. `/api/generate-all-clips` creates predictions → returns prediction IDs
2. Client polls `/api/poll-prediction` every 5s
3. API route checks Replicate status
4. When complete, updates Convex `videoClips` collection
5. Client reactively displays updated status

### Image Model Selection

Based on user's "image-generation-priority" answer:
- `speed` → Flux Schnell (fastest)
- `text-quality` → Flux Dev (better text rendering)
- `photorealism` → Flux Pro (highest quality)
- `artistic` → SDXL (stylized)

Logic in `lib/select-image-model.ts`, configuration in `lib/image-models.ts`.

### Phase Navigation

Projects track `lastActivePhase` to enable resuming:
- Update via `updateLastActivePhase` mutation when user enters phase
- `PhaseGuard` component enforces phase dependencies
- Router uses dynamic routes: `/[projectId]/[phase]`

### Editor Implementation

The timeline editor is built with:
- **Konva + React-Konva**: Canvas-based timeline rendering
- **Zustand**: Client-side state management
- **Convex**: Cloud persistence for projects and undo/redo history
- **MediaBunny**: Media processing in Web Workers
- **TypeScript**: All editor logic is pure TypeScript (no WebAssembly/C++)

## Debugging & Testing

**No formal test suite yet**. Development uses:
- Manual testing with demo mode
- Convex dashboard for database inspection
- Browser DevTools for client-side debugging
- API route logs in terminal

## Important Constraints

1. **Convex Document Size Limits**: Editor history is split into separate `projectHistory` collection to avoid hitting 1MB document limit
2. **Replicate Rate Limits**: Video generation is rate-limited by Replicate API
3. **Polling vs Webhooks**: Currently uses client polling (inefficient); webhooks not yet implemented
4. **No Optimistic Updates**: UI waits for Convex confirmation (slower UX)
5. **No Video Proxy**: Large video files served directly from Replicate/storage URLs

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_CONVEX_URL=...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
CLERK_JWT_TEMPLATE_NAME=convex
OPENAI_API_KEY=...
REPLICATE_API_TOKEN=...
```

## Authentication Flow

1. Clerk provides JWT tokens
2. Convex validates JWT via `auth.config.ts`
3. API routes use `auth()` from `@clerk/nextjs/server`
4. Client uses `ConvexReactClient` with Clerk integration

## Key Trade-offs & Design Decisions

1. **API Routes vs Convex Actions**: AI calls go through API routes (not Convex actions) for better error handling and streaming support
2. **Polling vs Webhooks**: Polling chosen for MVP simplicity (will migrate to webhooks)
3. **Separate History Collection**: Avoids Convex document size limits for undo/redo
4. **Client-side State (Zustand) + Server Sync (Convex)**: Enables instant UI updates with persistent backend
5. **Konva vs Canvas API**: Konva provides higher-level abstractions for timeline rendering
6. **MediaBunny in Worker**: Keeps media processing off main thread for responsive UI

## Future Architecture (See docs/architecture.md)

Planned features not yet implemented:
- Multi-provider routing (HeyGen, KlingAI, Veo3, RunwayML)
- Real-time collaboration (presence, comments, locks)
- Brand management system
- Template marketplace
- Advanced export with WebCodecs muxer and format optimization
- Webhook-based status updates (currently using polling)
- Analytics dashboard
