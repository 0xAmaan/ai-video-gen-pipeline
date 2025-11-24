# AI Video Generation Pipeline - Technical Summary

## 1. System Architecture
The system is a **real-time, event-driven application** built on **Next.js 16** (Frontend/API) and **Convex** (Backend/Database). It orchestrates multiple generative AI models to transform text prompts into professional video edits.

### Core Stack
*   **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui.
*   **Backend**: Convex (Serverless functions + Real-time Database).
*   **State Management**: Zustand (Client), Convex (Server), React Hook Form.
*   **Media Engine**: Custom **Konva**-based editor, **MediaBunny** (demuxing), **WebCodecs** (rendering), **Cloudflare R2** (storage).

---

## 2. The Generation Pipeline
The workflow progresses through 5 distinct phases, each managing state in Convex tables (`videoProjects`, `scenes`, `shotImages`, `videoClips`).

### Phase 1: Input & Planning (Prompt Engineering)
*   **Input**: User provides a high-level prompt.
*   **Process**: LLMs (OpenAI/Groq) analyze the request and generate **Clarifying Questions** to refine intent.
*   **Output**: Structured project metadata (Tone, Audience, Style) stored in `videoProjects`.

### Phase 2: Script & Storyboard (Text-to-Text/Image)
*   **Process**: 
    1.  **Script Generation**: LLM generates a multi-scene narrative (`scenes` table).
    2.  **Visual Prompting**: Converts narrative into stable diffusion prompts.
    3.  **Image Generation**: Parallel calls to **Leonardo Phoenix** / **FLUX** models via Replicate.
*   **Refinement (v2)**: Iterative **img2img** workflow allows users to regenerate specific shots (`shotImages`) before animating.

### Phase 3: Asset Synthesis (Audio & Voice)
*   **Voiceover**: **ElevenLabs** / **MiniMax** generates TTS audio per scene; synced to `scenes` table.
*   **Music**: **Google Lyria** / **MusicGen** creates background tracks based on mood.
*   **Storage**: Assets are stored in R2, referenced by `audioAssets`.

### Phase 4: Video Generation (Image-to-Video)
*   **Process**: Approved static shots are sent to **WAN 2.5**, **Kling**, or **Google Veo** (via Replicate).
*   **Lipsync**: Generated video clips are processed by **Replicate** lipsync models to match the voiceover.
*   **Async Polling**: Client/Server polls prediction status; updates `videoClips` table upon completion.

### Phase 5: Editor & Export (Composition)
*   **Timeline**: Browser-based editor using **Konva** canvas for rendering.
*   **State**: `editorProjects` stores the JSON state (tracks, clips, effects).
*   **Media Handling**: 
    *   **R2 Proxy**: Cloudflare Worker streams Range-request compatible video to the browser.
    *   **Web Workers**: Decode media off the main thread.
*   **Export**: Client-side **WebCodecs** muxer renders the final MP4 locally using the original high-res assets.

---

## 3. Data & Media Flow

### Data Lifecycle
1.  **User Action** $\rightarrow$ **Next.js API Route** (Middleware & Validation)
2.  **API** $\rightarrow$ **AI Provider** (Replicate/OpenAI) $\rightarrow$ **Prediction ID**
3.  **API** $\rightarrow$ **Convex Mutation** (Store pending state)
4.  **AI Webhook/Poll** $\rightarrow$ **Convex Mutation** (Update status to "complete")
5.  **Convex Query** $\rightarrow$ **React Component** (Real-time UI update via WebSocket)

### Media Pipeline (Zero-Egress)
1.  **Ingest**: AI models output to temporary URLs.
2.  **Proxy/Store**: **R2 Proxy Worker** fetches and streams content directly to **Cloudflare R2** (avoiding app server bandwidth).
3.  **Playback**: Client requests media via R2 Proxy (`/asset/:key`) which handles **HTTP Range Requests** for smooth scrubbing.
4.  **Export**: `encode-worker` fetches original assets, composites frames, and muxes audio/video into a Blob.

---

## 4. Key Technical Features
*   **Optimistic UI**: Instant feedback while AI jobs process in background.
*   **Resumable Workflow**: All state persisted in Convex; users can drop off and return.
*   **Parallel Processing**: Scene generation happens concurrently using async Promise patterns.
*   **Hybrid Rendering**: Canvas for preview (performance), WebCodecs for export (accuracy).
