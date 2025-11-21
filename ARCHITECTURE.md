# AI Video Generation Pipeline - Architecture & Tech Stack

## Table of Contents
1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Frontend Tech Stack](#frontend-tech-stack)
4. [Backend Tech Stack](#backend-tech-stack)
5. [Database & Storage](#database--storage)
6. [Key Features & Functionality](#key-features--functionality)
7. [External Services & Integrations](#external-services--integrations)
8. [Build Tools & Deployment](#build-tools--deployment)
9. [API Routes](#api-routes)
10. [Architecture Patterns](#architecture-patterns)
11. [Technology Summary](#technology-summary)
12. [Workflow Versions](#workflow-versions)
13. [Cost Estimation](#cost-estimation)
14. [Key Architectural Decisions](#key-architectural-decisions)

---

## Overview

This is an **enterprise-grade AI video generation platform** that combines advanced LLMs, generative AI models, and real-time collaborative editing in a modern full-stack architecture. The platform enables users to create professional videos from text prompts through an intelligent multi-phase workflow.

---

## Project Structure

```
/home/user/ai-video-gen-pipeline/
├── app/                          # Next.js 16 pages and API routes
│   ├── [projectId]/              # Dynamic project routes
│   │   ├── prompt/               # Clarifying questions phase
│   │   ├── character-select/     # Character selection phase
│   │   ├── storyboard/           # Scene editing phase
│   │   ├── video/                # Video generation phase
│   │   └── editor/               # Timeline editor phase
│   ├── project-redesign/         # New v2 redesigned workflow
│   │   ├── [projectId]/
│   │   ├── home/
│   │   └── projects/
│   ├── projects/                 # Project list page
│   ├── new/                      # New project creation
│   ├── api/                      # API routes (22 routes)
│   └── layout.tsx                # Root layout with providers
│
├── components/                   # React UI components
│   ├── ui/                       # shadcn/ui components
│   ├── editor/                   # Timeline editor components
│   ├── storyboard/               # Storyboard editing components
│   ├── audio/                    # Audio player/editor components
│   ├── input-phase/              # Input wizard components
│   └── redesign/                 # New workflow UI components
│
├── convex/                       # Convex backend functions
│   ├── schema.ts                 # Database schema (12 tables)
│   ├── video.ts                  # Video project mutations/queries
│   ├── editor.ts                 # Editor state mutations/queries
│   ├── projectRedesign.ts        # Redesign workflow functions
│   └── auth.config.ts            # Clerk authentication config
│
├── lib/                          # Shared utilities and logic
│   ├── editor/                   # Timeline editor library
│   │   ├── core/
│   │   ├── playback/
│   │   ├── export/
│   │   ├── workers/
│   │   ├── effects/
│   │   ├── transitions/
│   │   ├── filters/
│   │   └── io/
│   ├── adapters/                 # Audio/provider adapters
│   ├── image-models.ts           # Text-to-image model configs
│   ├── audio-models.ts           # Audio model configurations
│   ├── prompts.ts                # Prompt templates
│   └── utils.ts
│
├── hooks/                        # Custom React hooks
│   ├── useKeyboardShortcut.ts
│   ├── useSceneDragDrop.ts
│   └── useVoiceDictation.ts
│
└── public/                       # Static assets
```

---

## Frontend Tech Stack

### Core Framework & Runtime
- **Next.js 16.0.3** - Full-stack React framework with SSR, API routes, Turbopack
- **React 19.2.0** - Latest React with concurrent features
- **TypeScript 5** - Type-safe development
- **Bun 1.1+** - JavaScript runtime and package manager

### UI Framework & Styling
- **Tailwind CSS 4** - Utility-first CSS framework
- **shadcn/ui** - Accessible component library
- **Radix UI** - Headless component primitives (26+ components)
  - Dialogs, Dropdowns, Menus, Tabs, Accordions, Toggles, Sliders, etc.
- **Lucide React** - Icon library
- **Framer Motion 12.23.24** - Animation library
- **Embla Carousel** - Carousel component

### State Management
- **Zustand 5.0.8** - Lightweight state store
- **React Hook Form 7.66.0** - Form state management
- **Convex Client** - Real-time database queries/mutations

### Editor & Canvas
- **Konva 10.0.9** - Canvas library for timeline rendering
- **React Konva 19.2.0** - React bindings for Konva
- **MediaBunny 1.25.0** - Media processing and ingest
- **react-resizable-panels 3.0.6** - Resizable UI panels

### Drag & Drop
- **@dnd-kit/core 6.3.1** - Modern drag-and-drop
- **@dnd-kit/sortable 10.0.0** - Sortable list support
- **@dnd-kit/utilities 3.2.2** - Helper utilities

### Data & Validation
- **Zod 4.1.12** - TypeScript-first schema validation
- **AI SDK 5.0.93** - Unified AI provider interface
  - @ai-sdk/openai 2.0.67
  - @ai-sdk/groq 2.0.29

### UI/UX Tools
- **cmdk 1.1.1** - Command palette
- **input-otp 1.4.2** - OTP input components
- **sonner 2.0.7** - Toast notifications
- **react-day-picker 9.11.1** - Date picker
- **next-themes 0.4.6** - Dark mode support
- **vaul 1.1.2** - Drawer component
- **Recharts 3.4.1** - Data visualization
- **class-variance-authority 0.7.1** - Component variants
- **clsx 2.1.1** - Class name utility
- **tailwind-merge 3.4.0** - Tailwind class merging

### Authentication
- **@clerk/nextjs 6.35.1** - User authentication and management

---

## Backend Tech Stack

### Database & Backend
- **Convex 1.29.2** - Real-time database + serverless functions
  - Real-time queries/mutations
  - Built-in authentication
  - Cloud hosting
  - Auto-scaling

### AI/ML Services

#### Text-to-Text Models
- **OpenAI GPT-4o-mini** - Scene/narration generation
- **OpenAI GPT-5 Nano/Mini** - Advanced text generation
- **Groq (gpt-oss-20b)** - Fast open-source alternative via AI SDK

#### Text-to-Image Models
- **Leonardo Phoenix 1.0** - Primary image generation (photorealistic, $0.032/img)
- **FLUX.1 Schnell** - Fast iteration ($0.003/img)
- **FLUX.1 Pro** - Text rendering & consistency ($0.04/img)
- **FLUX.1 Pro Ultra** - Maximum quality ($0.055/img)
- **Stable Diffusion XL** - Photorealism ($0.008/img)
- **Stable Diffusion 3 Medium** - High-fidelity with LoRA support
- **HiDream-I1** - Artistic + photorealistic
- **Consistent Character** - Character consistency across scenes (InstantID + IPAdapter)

#### Image-to-Video Models
- **WAN 2.5 Image-to-Video Fast** - Primary video model (5s videos, $0.34/clip)
- **SeéDance 1.0 Lite** - Lightweight motion generation
- **Google Veo 3.1** - High-quality cinematic (4-8s videos)
- **Google Veo 3.1 Fast** - Faster Veo variant
- **Minimax Hailuo 2.3 Fast** - Prompt optimization
- **Kling v2.5 Turbo Pro** - Professional turbo generation
- **ByteDance SeéDance Pro Fast** - Camera control support

#### Voice Synthesis
- **ElevenLabs** - Text-to-speech with multiple voices and emotion control
- **Replicate MiniMax TTS** - Alternative voice synthesis provider

#### Music Generation
- **Google Lyria 2** - High-fidelity music generation (48kHz stereo)
- **MusicGen Large** - Meta's music generation model
- **Riffusion v1** - Loop-based audio generation

#### Sound Effects
- **Freesound API** - Stock sound library integration

#### Lipsync & Avatar
- **Replicate Lipsync Models** - Video lipsync processing

### AI Integration Provider
- **Replicate** - Unified API for multiple ML models
  - Model hosting and inference
  - Prediction tracking with webhooks
  - Async job processing

---

## Database & Storage

### Convex Database Schema (12 Tables)

#### Core Video Project Tables

**videoProjects** - Main project records
- userId, prompt, title, status, workflowVersion
- Workflow phases: `draft → questions_generated → storyboard_created → video_generated`
- Support for both `v1_legacy` and `v2_redesign` workflows

**clarifyingQuestions** - Interactive question prompts
- Dynamic question/answer pairs
- Question metadata with options

**scenes** - Video scenes with narrative
- Description, visualPrompt, duration, narrationText
- Image storage (Convex storage ID + URL)
- Voice settings (voiceId, emotion, speed, pitch)
- Background music configuration

**videoClips** - Generated video clips
- Status tracking (pending/processing/complete/failed/cancelled)
- Replicate prediction IDs for async polling
- Resolution metadata
- Lipsync processing state

**projectVoiceSettings** - Persistent voice configuration
- Selected voice, emotion, speed, pitch
- Provider info (replicate/elevenlabs)

#### Audio Management

**audioAssets** - Audio library
- Type (bgm/sfx/narration/voiceover)
- Source (generated/freesound/uploaded/external)
- Beat marker timing for sync

#### Editor State

**editorProjects** - Timeline editor projects (Konva-based)
- Full project state as JSON
- Real-time sync with client

**projectHistory** - Undo/redo snapshots
- Past/future history stacks
- Sequence numbering

#### Redesigned Workflow v2 Tables

**projectScenes** - Top-level scene groupings
- Scene number, title, description

**sceneShots** - Individual shots within scenes
- Shot number, description, initialPrompt
- Selected image reference

**shotImages** - Image iterations for refinement (img2img workflow)
- Iteration tracking (0 = initial, 1+ = refinements)
- Variant numbering (0-5 variants per iteration)
- Favorite marking
- Parent image tracking for refinement chains

**storyboardSelections** - Final shot choices
- Selected image per shot
- Animation status
- Animated video URL (from i2v model)

---

## Key Features & Functionality

### Multi-Phase Workflow

#### Phase 1: Input & Planning
- Initial prompt input
- AI-generated clarifying questions
- User answers collected and refined
- Optional voice dictation for input

#### Phase 2: Storyboard Generation
- Scene descriptions (3-5 scenes)
- Visual prompts for each scene
- Narration script generation
- Voice synthesis (ElevenLabs or Replicate MiniMax)
- Parallel image generation (Leonardo Phoenix, FLUX variants)
- Duration estimation per scene

#### Phase 3: Character Selection & Refinement
- Character variation generation
- Visual style selection
- Reference image-based generation (Flux Kontext)

#### Phase 4: Video Generation
- Parallel clip generation for all scenes
- Lipsync processing (mouth-synced to narration)
- Music track generation
- Real-time progress polling

#### Phase 5: Editor & Composition
- CapCut-style timeline editor
- Clip trimming and splitting
- Effects library (brightness, contrast, saturation, grain, color grading, vintage, vignette, filmLook)
- Transitions (50+ preset transitions)
- Speed curves and frame-accurate control
- Audio mixing (narration, BGM, SFX tracks)
- Export to multiple formats
- Undo/redo with Convex persistence

### New v2 Redesign Workflow
- **Prompt Planner**: Detailed project planning
- **Scene Planner**: Break story into scenes with shots
- **Shot Iterator**: Image refinement using img2img
- **Storyboard Assembly**: Final selection and animation
- Real-time collaboration-ready architecture

### Editor Features
- **Canvas-based Timeline**: Konva renderer with frame-accurate scrubbing
- **Multi-track Audio**: Narration, background music, sound effects layers
- **Media Management**: MediaBunny for file processing
- **Workers**: Dedicated Web Workers for:
  - Video demultiplexing
  - Effects processing
  - Export encoding
- **Frame Caching**: Performance optimization for playback
- **Thumbnail Caching**: Quick preview generation
- **Transitions**: 50+ presets with customizable easing
- **Effects Processing**: Real-time color grading and filters
- **Export Pipeline**: WebCodecs muxer with File System Access API

---

## External Services & Integrations

### Authentication & User Management
- **Clerk** - User auth, OAuth, team management, JWT tokens

### AI/ML Service Providers
- **OpenAI** - GPT-4o, GPT-5 models for text generation
- **Groq** - Fast open-source models via AI SDK
- **Replicate** - Model hosting, inference, async job tracking
- **ElevenLabs** - Voice synthesis with emotional control
- **Freesound API** - Sound effect library

### Cloud Infrastructure
- **Vercel** - Next.js deployment, serverless functions, edge network
- **Convex Cloud** - Database and backend hosting

### Content Delivery
- **Convex Storage** - File hosting for images/videos
- **Replicate Output URLs** - Generated media hosting

---

## Build Tools & Deployment

### Build & Development Tools
- **Next.js 16** with **Turbopack** - Fast bundling
- **TypeScript 5** - Type checking
- **Bun** - Fast package management and runtime
- **Concurrently** - Run multiple dev processes (Next.js + Convex)

### Configuration Files
- `package.json` - 65+ dependencies, dev scripts
- `tsconfig.json` - Target ES2017, JSX support, path aliases (@/*)
- `next.config.ts` - Next.js configuration
- `tailwind.config.js` - CSS framework config
- `postcss.config.mjs` - PostCSS plugins
- `components.json` - shadcn/ui configuration

### Development Scripts
```json
{
  "dev": "concurrently \"bun run dev:next\" \"bun run dev:convex\"",
  "dev:next": "next dev --turbopack",
  "dev:convex": "npx convex dev",
  "build": "next build",
  "start": "next start"
}
```

### Deployment
- **Platform**: Vercel (Next.js) + Convex Cloud
- **Environment Variables**: Clerk, OpenAI, Groq, Replicate, ElevenLabs API keys
- **Auto-deployment**: Git push to main branch

---

## API Routes

### Text Generation
- `/api/generate-questions` - Clarifying question generation
- `/api/generate-voice-selection` - Select voice for project

### Image Generation
- `/api/generate-storyboard` - Scenes + images + narration
- `/api/generate-character-variations` - Character iteration
- `/api/regenerate-scene` - Regenerate single scene image
- `/api/regenerate-narration` - Regenerate scene narration

### Video Generation
- `/api/generate-video-clip` - Single clip i2v generation
- `/api/generate-all-clips` - Batch video generation
- `/api/poll-prediction` - Check Replicate job status
- `/api/cancel-prediction` - Cancel in-progress job
- `/api/lipsync-video` - Apply lipsync to video
- `/api/poll-lipsync` - Poll lipsync status

### Audio
- `/api/generate-music` - Music generation
- `/api/generate-scene-narration` - Scene voice-over
- `/api/generate-voice-elevenlabs` - ElevenLabs voice synthesis
- `/api/list-elevenlabs-voices` - List available voices
- `/api/preview-voice` - Preview voice sample
- `/api/generate-lipsync-clips` - Generate lipsync variants
- `/api/search-audio` - Freesound search

### Admin
- `/api/test-speed` - Speed testing
- `/api/project-redesign/*` - Redesign workflow endpoints

---

## Architecture Patterns

### State Management Pattern
1. **Zustand Store** for local client state
2. **Convex Real-time Queries** for server state
3. **Optimistic Updates** for UI responsiveness
4. **Automatic Sync** via Convex subscriptions

### API Pattern
1. **Next.js API Routes** as middleware
2. **External AI Provider Calls** from routes
3. **Convex Mutations** to persist data
4. **Client Polling** for async job status (upgrade planned: webhooks)

### Authentication Pattern
1. **Clerk JWT** from browser
2. **Clerk → Convex Auth** via auth.config.ts
3. **User Identity** checked in mutations/queries

### Data Flow Pattern
```
UI Input → API Route → AI Provider → Convex Mutation → Real-time Query → UI Update
```

### Editor Pattern
1. **Zustand Store** for timeline state
2. **Convex Adapter** for persistence
3. **Web Workers** for heavy processing
4. **Canvas Rendering** via Konva for timeline
5. **AudioWorklet** for audio playback

---

## Technology Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16, React 19, TypeScript | UI framework |
| **Styling** | Tailwind CSS 4, shadcn/ui, Radix UI | Design system |
| **State** | Zustand, React Hook Form, Convex | State management |
| **Editor** | Konva, MediaBunny, Web Workers | Timeline editing |
| **Forms** | React Hook Form, Zod | Form validation |
| **UI Components** | Radix UI, Lucide, Framer Motion | Interactive elements |
| **Authentication** | Clerk | User management |
| **Database** | Convex | Real-time DB |
| **Text AI** | OpenAI (GPT-4o), Groq | Text generation |
| **Image AI** | Leonardo, FLUX, Stable Diffusion | Image generation |
| **Video AI** | Replicate (WAN, Veo, Kling, SeéDance) | Video generation |
| **Voice AI** | ElevenLabs, MiniMax TTS | Voice synthesis |
| **Music AI** | Google Lyria, MusicGen | Music generation |
| **Audio Library** | Freesound API | Sound effects |
| **Lipsync** | Replicate Models | Video lipsync |
| **Deployment** | Vercel, Convex Cloud | Hosting |
| **Package Manager** | Bun | Runtime & Package mgmt |

---

## Workflow Versions

### V1 (Legacy)
Original 4-phase workflow:
- Input → Clarifying Questions → Storyboard → Video Generation → Editor

### V2 (Redesign)
New iterative workflow:
- Prompt Planning → Scene Setup → Shot Iteration (img2img) → Storyboard Assembly
- More granular control and refinement capability
- Better for character consistency
- Image selection and final animation per shot

---

## Cost Estimation

### Per Project Typical Costs
- Text generation (questions): ~$0.01
- Scene descriptions: ~$0.02
- Image generation (5 scenes × $0.032 Leonardo): ~$0.16
- Video generation (5 clips × $0.34): ~$1.70
- Music generation: ~$0.01
- Voice synthesis (5 narrations): ~$0.05

**Total per project: ~$1.95** (varies by model selection)

---

## Key Architectural Decisions

1. **Convex over traditional backend** - Real-time sync, serverless, simpler ops
2. **Next.js API routes** - Lightweight middleware for AI provider calls
3. **Zustand + Convex** - Fast local updates + reliable persistence
4. **Replicate API** - Unified interface for 20+ ML models
5. **Web Workers** - Keep main thread responsive during processing
6. **Canvas-based editor** - Better performance than DOM for timeline
7. **Dual workflow versions** - Support legacy + new iterative approach
8. **Component-driven UI** - Radix + shadcn for accessibility and consistency

---

## Recent Developments

- UI fixes and improvements
- Dependency updates for security and performance
- Voice dictation feature added
- Delete projects functionality
- Project redesign workflow (v2) implementation
- Enhanced collaborative features
