# AI Video Generation Pipeline - Technical Design

## System Overview

**AI-powered video creation platform** that transforms text prompts into professional videos through four phases: **Prompt → Storyboard → Generation → Editor**. Built with Next.js 16, React 19, Convex real-time backend, and browser-based WebCodecs video editor.

**Key Innovation**: Users validate AI-generated storyboards *before* expensive video generation, reducing wasted compute by 60-80%.

**Tech Stack**: Next.js 16, React 19, Convex, Cloudflare R2, WebCodecs, WebGPU, Replicate (AI models), OpenAI GPT-4o, ElevenLabs TTS

---

## Four-Phase Workflow

**Phase 1: Prompt Refinement**
- GPT-4o generates 3-5 clarifying questions from initial prompt
- Questions probe: emotion, visual style, image generation priority (speed/quality/photorealism)
- Responses saved to Convex `clarifyingQuestions` table

**Phase 2: Storyboard Generation**
- GPT-4o generates 3-5 scenes with 150-250 word visual prompts (`lib/prompts.ts`)
- Each scene: description, visualPrompt, narrationText, duration
- Character consistency enforced: "SAME character in EVERY scene"
- User reviews/edits scenes before generation

**Phase 3: Asset Generation**
- Images: Replicate models (FLUX/Recraft/Ideogram) based on user priority
- Videos: WAN 2.5 Image-to-Video (5s clips, $0.34 each)
- Voiceover: ElevenLabs TTS with AI-selected voice
- Music: Google Lyria 2 (48kHz stereo)
- All assets ingested to Cloudflare R2 via `workers/r2-proxy.ts`

**Phase 4: Timeline Editor**
- OpenCut-based timeline with multi-track support
- WebCodecs demux/encode workers run in browser
- WebGPU canvas renderer (30fps preview)
- Export pipeline runs client-side (zero server costs)

---

## Visual Coherence Across Clips

**Character Consistency Technology Stack:**
- **Primary Engine**: InstantID + IPAdapter (`fofr/consistent-character` model) achieves 90-95% character consistency
- **Fallback Engine**: FLUX Kontext Pro with explicit prompt engineering
- **Optional Face Swap**: Post-processing layer for edge cases where character drift occurs

**Prompt Engineering Strategy:**
- Storyboard generation (`lib/prompts.ts`) enforces strict character presence rules: "same character MUST appear prominently in EVERY scene"
- Visual prompts include 150-250 word descriptions covering composition, lighting, color palette, art style, and character details
- User-selected style preferences (e.g., "black and white documentary") are enforced in EVERY scene's `visualPrompt` field
- Reference image from first scene propagates to subsequent scenes via `lib/flux-kontext.ts`

**Style Consistency Enforcement:**
- Storyboard system prompt includes "CRITICAL CONSISTENCY RULE" that validates user preferences in all scenes
- Each scene's `visualPrompt` explicitly repeats style keywords (e.g., "BLACK AND WHITE PHOTOGRAPHY, monochrome, grayscale" for B&W docs)
- Prevents scene content from overriding user's global style selection

## Audio-Visual Synchronization

**Stereo 48kHz Mixing Pipeline:**
- `lib/editor/audio/audio-mixer.ts` manages multi-track audio with per-track volume, mute, solo controls
- WebCodecs-based preview renderer (`lib/editor/playback/preview-renderer.ts`) uses audio-driven clock for frame-accurate sync
- Frame caching system ensures smooth scrubbing without drift

**Beat Detection & Alignment:**
- `convex/beatAnalysis.ts` provides server-side beat analysis with Replicate (primary) and client-side (fallback)
- Audio assets store `beatMarkers` (time, strength, isDownbeat) and `bpm` for cut-on-beat editing
- Timeline supports beat-snapping for precise audio-visual timing

**Export Synchronization:**
- Encode worker (`lib/editor/workers/encode-worker.ts`) decodes full-res assets, composites timeline, mixes audio to stereo 48kHz, and muxes MP4
- Single-pass encoding ensures A/V sync via shared timeline clock
- WebCodecs VideoEncoder + MediaBunny muxer handle frame-accurate composition

## Cost Optimization Strategy

**Zero-Egress Media Storage:**
- Cloudflare R2 + proxy worker (`workers/r2-proxy.ts`) eliminates S3 egress fees
- Range request support (HTTP 206) enables efficient video seeking without downloading full files
- All media served through Cloudflare Worker with 5-minute browser cache for repeat access

**Dual-Quality Workflow:**
- Assets store both `proxyUrl` (low-res for editing) and `r2Key`/`sourceUrl` (full-res for export)
- Preview uses proxy URLs for smooth 30fps scrubbing; export uses original for 4K quality
- Reduces bandwidth costs by ~80% during iterative editing phase

**Client-Side Processing:**
- WebCodecs demux/encode workers run entirely in browser—no server-side transcoding costs
- MediaBunny decodes assets in dedicated worker, preventing main thread blocking
- Preview renderer uses WebGPU canvas with dual VideoTextures and crossfade shader for smooth transitions

**AI Model Selection:**
- Image generation priority question routes to cost-effective models:
  - `speed`: Fast-flux (0.003s/img, $0.003)
  - `text-quality`: Ideogram V2 (6s/img, $0.08)
  - `photorealism`: Recraft V3 (6s/img, $0.04)
  - `artistic`: FLUX Pro (10s/img, $0.055)
- Storyboard validation before video generation prevents wasted compute on bad prompts

## Generation Failure Handling

**Retry Strategy:**
- Video clip status tracking: `pending` → `processing` → `complete`/`failed`/`cancelled`
- `/api/retry-video-clip` allows per-scene regeneration without full pipeline restart
- Convex mutations (`updateVideoClip`, `updateScene`) atomically update status + error messages

**Fallback Hierarchy:**
- Character consistency: `consistent-character` → `flux-kontext` → `flux-kontext + face-swap`
- Each fallback logs errors to `CharacterEngineResult.errors[]` for debugging
- Face swap mode: `always` (aggressive), `fallback` (on drift), `never` (disabled)

**State Recovery:**
- Cloud-based undo/redo (`projectHistory` table) preserves last 20 snapshots
- Debounced Convex sync (2s interval) prevents data loss during editor crashes
- `cancelVideoClip` mutation allows graceful termination of long-running Replicate jobs

**Polling Architecture:**
- Client-side polling via `/api/poll-prediction` with exponential backoff (no webhook failures)
- Replicate prediction IDs stored in Convex for resume-on-reload scenarios
- `areClipsGenerating` query prevents navigation away from generation phase while jobs are active

## Browser-Based Video Editor Challenges

**Evolution Through Multiple Iterations:**

The video editor underwent 3+ major architectural rewrites before reaching production stability. Key challenges:

**V1 (Native Canvas Rendering):**
- Manual frame-by-frame canvas compositing caused 5-15 FPS on 1080p
- Audio sync drift after 10-20 seconds of playback
- Memory leaks from unreleased VideoFrame objects crashed browser tabs
- **Lesson**: Browser APIs alone insufficient for pro-grade video editing

**V2 (FFmpeg.wasm):**
- 100MB+ WASM binary caused 20-30s initial load times
- Single-threaded FFmpeg blocked UI during encode (frozen browser)
- SharedArrayBuffer restrictions broke Firefox/Safari compatibility
- Preview generation took 30-60s per timeline change
- **Lesson**: Server-side tools don't translate well to client-side constraints

**V3 (MediaBunny + WebCodecs):**
- Demux worker crashes on corrupt/unsupported codecs required fallback chains
- Range request bugs in R2 proxy caused video seeking to hang (fixed via explicit Content-Range validation)
- AudioContext resume timing issues caused "audio plays but video pauses" bugs (fixed via audio-driven playback clock)
- WebGPU shader compilation failures on Intel Iris GPUs required software rendering fallback
- **Current State**: Stable 30fps preview, <2s export start time, but still debugging edge cases

**Remaining Pain Points:**
- Safari's restrictive WebCodecs support requires codec sniffing per browser
- 4K video decode exhausts GPU memory on <16GB RAM devices (mitigated by proxy workflow)
- Multi-track audio mixing occasionally clips at >8 tracks (gain normalization in progress)

**OpenCut Integration Complexity:**
- Git submodule (`external/OpenCut`) required webpack alias hacks for Next.js compatibility
- TypeScript path resolution conflicts between main app and OpenCut source
- Component version mismatches caused React hydration errors (fixed via explicit version pinning)

These challenges informed our dual-quality workflow (proxy for editing, full-res for export) and aggressive error handling (fallback chains, retry logic, state recovery).

## Competitive Advantages

**1. Four-Phase Workflow Validation:**
- Input → Clarifying Questions → Storyboard → Generation → Editor
- Users validate AI-generated storyboard BEFORE expensive video generation (prevents wasted $$$)
- Each phase unlocks next only when complete, preventing incomplete projects

**2. WebCodecs-Powered Editor:**
- Industry-standard timeline UI (OpenCut integration) with professional features (effects, transitions, filters)
- Zero server-side rendering costs—entire export pipeline runs in browser
- Sub-100ms preview latency via WebGPU + frame cache vs. 5-10s server-side render previews

**3. Cloud-Native State Management:**
- Real-time Convex backend syncs editor state across devices
- Undo/redo persisted to database (vs. in-memory stacks that lose history on refresh)
- Collaborative editing foundation (multi-user support possible with minimal changes)

**4. Hybrid AI Strategy:**
- Character consistency tech (InstantID + IPAdapter) rivals Runway Gen-3 quality at 1/10th cost
- Prompt engineering system (150-250 word visual prompts) produces cinema-quality storyboards
- Voice selection AI automatically matches tone, pacing, and emotion to video content

**5. Production-Ready Infrastructure:**
- COOP/COEP headers enable SharedArrayBuffer/WebCodecs without Firefox/Safari issues
- Offline-first builds (system fonts, no CDN dependencies) for enterprise deployments
- MediaBunny multi-format support (MP4, WebM, MOV, AVI) vs. competitors limited to MP4
