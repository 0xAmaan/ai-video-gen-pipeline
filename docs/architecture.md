# AI Video Generation Pipeline - System Architecture

## Overview

**Current State**: MVP - Core workflow functional (Prompt → Questions → Storyboard → Video Generation → Basic Editor)
**PRD Vision**: Enterprise multi-provider AI orchestration with real-time collaboration, brand management, and distribution

**Stack**: Next.js 16 + React 19 + Convex + Clerk + OpenAI + Replicate
**Pattern**: Serverless real-time architecture with client-side state management

---

## Architecture Diagram

```mermaid
graph TB
    subgraph "Client Browser"
        subgraph "Next.js 16 Application"
            UI[UI Layer - React 19]

            subgraph "Page Components"
                HomePage[Home Page<br/>Auth Landing]
                NewPage[New Page<br/>Initial Prompt Input]
                PromptPage[Prompt Page<br/>Clarifying Questions]
                StoryboardPage[Storyboard Page<br/>Scene Review/Edit]
                VideoPage[Video Page<br/>Generation Progress]
                EditorPage[Editor Page<br/>CapCut-style Editor]
            end

            subgraph "Phase Components"
                InputPhase[Input Phase<br/>Prompt + Clarifying Questions<br/>Multi-step wizard]
                StoryboardGenPhase[Storyboard Gen Phase<br/>Loading + Progress<br/>Scene generation status]
                StoryboardPhase[Storyboard Phase<br/>Scene editing + Timeline<br/>Drag-drop reordering]
                VideoGenPhase[Video Gen Phase<br/>Parallel clip generation<br/>Real-time progress tracking]
                EditorPhase[Editor Phase<br/>Video preview + Timeline<br/>Basic playback controls]
            end

            subgraph "UI Components"
                QuestionCard[Question Card<br/>Interactive Q&A]
                ExportModal[Export Modal<br/>Format selection UI]
                UIKit[shadcn/ui Components<br/>Button/Card/Dialog/etc]
            end

            subgraph "State Management"
                ProjectState[Project State<br/>prompt, responses, scenes<br/>clips, phase tracking]
                ConvexClient[Convex Client<br/>Real-time queries/mutations<br/>Auto-sync]
            end

            subgraph "Client-Side Logic"
                PhaseOrchestration[Phase Orchestration<br/>Workflow state machine<br/>Phase transitions]
                PollingLogic[Polling Logic<br/>Video generation status<br/>Retry + timeout handling]
            end
        end
    end

    subgraph "Backend Services - Next.js API Routes"
        subgraph "AI Integration APIs"
            GenQuestions[/api/generate-questions<br/>OpenAI GPT-4<br/>Clarifying Q generation]
            GenStoryboard[/api/generate-storyboard<br/>OpenAI + Flux Schnell<br/>Scene descriptions + images]
            GenAllClips[/api/generate-all-clips<br/>Replicate API<br/>Batch prediction creation]
            PollPrediction[/api/poll-prediction<br/>Replicate API<br/>Status checking]
            RegenerateScene[/api/regenerate-scene<br/>Flux Schnell<br/>Single image regen]
        end
    end

    subgraph "Backend Infrastructure"
        subgraph "Authentication"
            Clerk[Clerk Auth<br/>User Management<br/>JWT tokens<br/>OAuth integration]
        end

        subgraph "Real-time Database & Backend"
            Convex[(Convex<br/>Real-time DB + Backend<br/>Collections:<br/>- videoProjects<br/>- clarifyingQuestions<br/>- scenes<br/>- videoClips<br/>- finalVideos<br/>Serverless functions)]
        end

        subgraph "AI Provider APIs"
            OpenAI[OpenAI API<br/>GPT-4<br/>Text generation]
            FluxSchnell[Replicate Flux Schnell<br/>Image generation<br/>Fast, high-quality]
            ReplicateWAN[Replicate WAN 2.5<br/>i2v Fast<br/>Image-to-video<br/>5s or 10s clips<br/>$0.34/clip]
        end
    end

    subgraph "Missing Components - PRD Vision"
        subgraph "Not Yet Implemented"
            MultiProvider[Multi-Provider Routing<br/>HeyGen, KlingAI, Veo3<br/>RunwayML integration<br/>Intelligent model selection]
            BrandMgmt[Brand Management<br/>Brand profiles<br/>Guidelines enforcement<br/>Asset library]
            Collaboration[Real-time Collaboration<br/>Multi-user editing<br/>Presence system<br/>Comments/annotations]
            ExportEngine[Export & Distribution<br/>Multi-format rendering<br/>Platform optimization<br/>Social media publishing]
            CapCutEngine[CapCut WebAssembly<br/>Advanced editing<br/>Transitions/effects<br/>Professional timeline]
        end
    end

    %% Page to Phase connections
    NewPage --> InputPhase
    PromptPage --> InputPhase
    StoryboardPage --> StoryboardPhase
    VideoPage --> VideoGenPhase
    EditorPage --> EditorPhase

    %% Phase to State connections
    InputPhase --> ProjectState
    StoryboardPhase --> ProjectState
    VideoGenPhase --> ProjectState
    EditorPhase --> ProjectState

    %% State to Convex connections
    ProjectState --> ConvexClient
    ConvexClient -->|Real-time queries| Convex
    ConvexClient -->|Mutations| Convex

    %% Phase orchestration
    PromptPage --> PhaseOrchestration
    PhaseOrchestration --> ProjectState

    %% API Routes connections
    InputPhase -->|POST prompt| GenQuestions
    StoryboardGenPhase -->|POST prompt+responses| GenStoryboard
    StoryboardPhase -->|POST visual prompt| RegenerateScene
    VideoGenPhase -->|POST scenes| GenAllClips
    VideoGenPhase --> PollingLogic
    PollingLogic -->|POST predictionId| PollPrediction

    %% API to AI Provider connections
    GenQuestions -->|Chat completion| OpenAI
    GenStoryboard -->|Chat + Image gen| OpenAI
    GenStoryboard -->|Image generation| FluxSchnell
    GenAllClips -->|Create predictions| ReplicateWAN
    PollPrediction -->|Check status| ReplicateWAN
    RegenerateScene -->|Image generation| FluxSchnell

    %% Convex to Clerk
    Convex -->|Auth verification| Clerk
    ConvexClient -->|User session| Clerk

    %% Data flow paths
    Convex -->|Real-time sync<br/>Auto-invalidation<br/>Optimistic updates| ConvexClient

    %% User interactions
    User([Users<br/>Content Creators<br/>Marketing Teams<br/>Ad Directors]) -->|Interact| UI
    User -->|Authenticate| Clerk

    %% Styling
    classDef client fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef backend fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef ai fill:#e8f5e9,stroke:#388e3c,stroke-width:2px
    classDef missing fill:#ffebee,stroke:#c62828,stroke-width:2px,stroke-dasharray: 5 5
    classDef user fill:#fce4ec,stroke:#c2185b,stroke-width:3px

    class HomePage,NewPage,PromptPage,StoryboardPage,VideoPage,EditorPage,InputPhase,StoryboardGenPhase,StoryboardPhase,VideoGenPhase,EditorPhase,QuestionCard,ExportModal,UIKit,ProjectState,ConvexClient,PhaseOrchestration,PollingLogic client
    class GenQuestions,GenStoryboard,GenAllClips,PollPrediction,RegenerateScene,Clerk,Convex backend
    class OpenAI,FluxSchnell,ReplicateWAN ai
    class MultiProvider,BrandMgmt,Collaboration,ExportEngine,CapCutEngine missing
    class User user
```

---

## Core Components

### Frontend (Next.js 16 + React 19)

**Pages**:
- `app/page.tsx`: Auth landing (Clerk integration, redirects to /new)
- `app/new/page.tsx`: Initial prompt input (creates project, redirects to /{projectId}/prompt)
- `app/[projectId]/prompt/page.tsx`: Clarifying questions workflow
- `app/[projectId]/storyboard/page.tsx`: Scene review and editing
- `app/[projectId]/video/page.tsx`: Parallel video generation with real-time progress
- `app/[projectId]/editor/page.tsx`: CapCut-style timeline editor

**Phase Components** (`components/`):
- `InputPhase`: Prompt + clarifying questions (multi-step wizard, keyboard nav)
- `StoryboardGeneratingPhase`: Loading screen with progress
- `StoryboardPhase`: Scene editing (drag-drop, duration, regenerate, timeline)
- `VideoGeneratingPhase`: Parallel generation tracking (real-time status)
- `EditorPhase`: Video preview + basic playback (export placeholder)

**State**:
```typescript
VideoProject: { prompt, responses, scenes[], clips[] }
Phase: "input" | "generating_storyboard" | "storyboard" | "generating_video" | "editor"
```

### Backend

**Clerk**: Auth + user management (JWT, OAuth, teams)

**Convex**: Real-time database + serverless functions

**Collections**:
```typescript
videoProjects: { userId, prompt, status, createdAt, updatedAt }
clarifyingQuestions: { projectId, questions[], answers }
scenes: { projectId, sceneNumber, description, imageUrl, duration }
videoClips: { sceneId, projectId, videoUrl, status, replicateVideoId }
finalVideos: { projectId, videoUrl, duration, clipCount, totalCost } // unused
```

**API Routes** (`app/api/`):
- `/generate-questions`: OpenAI GPT-4 → clarifying questions (2-5s)
- `/generate-storyboard`: GPT-4 + Flux Schnell → scenes + images (10-20s)
- `/generate-all-clips`: Replicate WAN 2.5 → batch predictions ($0.34/clip)
- `/poll-prediction`: Check video generation status (client polls 5s)
- `/regenerate-scene`: Flux Schnell → new scene image (3-5s)

**AI Providers**:
- **OpenAI GPT-4**: Question + scene description generation
- **Replicate Flux Schnell**: Image generation (~$0.003/image)
- **Replicate WAN 2.5 i2v**: Image-to-video 5-10s clips ($0.34/clip)

---

## Key Data Flows

**1. Prompt → Questions** (2-5s):
```
User prompt → /api/generate-questions → GPT-4 → Convex.saveQuestions() → UI
```

**2. Answers → Storyboard** (10-20s):
```
User answers → /api/generate-storyboard → GPT-4 (descriptions) → Flux Schnell (5 images parallel) → Convex.saveScenes() → UI
```

**3. Storyboard → Videos** (60-180s per clip):
```
Generate click → /api/generate-all-clips → WAN 2.5 (parallel predictions)
→ Client polls /api/poll-prediction (5s intervals, 15min max)
→ Convex.updateVideoClip(status, videoUrl) → UI updates → All complete → Editor
```

**4. Real-time Editing** (<100ms):
```
User edits scene → Local state update (instant feedback) → Convex.updateScene() → Auto re-query → UI sync
```

**5. Scene Regeneration** (3-5s):
```
Sparkles click → /api/regenerate-scene → Flux Schnell → Convex.updateScene(imageUrl) → UI
```

---

## Performance & Optimization

| Metric | Target | Status |
|--------|--------|--------|
| UI Frame Rate | 60 FPS | ✅ |
| Question Generation | <5s | ✅ 2-5s |
| Storyboard Generation | <30s | ✅ 10-20s |
| Video Clip Generation | <120s | ⚠️ 60-180s |
| Convex Sync | <100ms | ✅ |
| DB Read/Write | <100ms | ✅ |

**Optimizations**:
- ✅ Parallel AI operations (storyboard images, video clips)
- ✅ Real-time Convex sync with auto-invalidation
- ✅ Next.js code splitting + Turbopack
- ❌ Client polling inefficient (should use webhooks)
- ❌ No video proxy for large files
- ❌ No optimistic updates



---

## Deployment

**Development**:
```bash
bun install
bunx convex dev    # Terminal 1
bun run dev        # Terminal 2
```

**Production**:
- Vercel (Next.js) + Convex Cloud
- Environment vars: Clerk, OpenAI, Replicate API keys
- Auto-deploy on git push


---

## Gaps & Limitations

**Missing from PRDs**:
- Multi-provider routing (HeyGen, KlingAI, Veo3, RunwayML)
- Intelligent model selection + cost optimization
- CapCut WebAssembly integration
- Real-time collaboration (presence, comments, locks)
- Brand management system
- Template marketplace
- Platform distribution (social media APIs)
- Analytics dashboard
- Quality assessment pipeline
- Approval workflows

---

## Architecture Evolution Roadmap

### Phase 1: MVP Hardening (Current → 3 months)

**Goals**: Production-ready MVP with core features stable

**Tasks**:
1. Add comprehensive test coverage (unit + integration)
2. Implement project dashboard and history
3. Add webhook support for video generation
4. Implement basic export functionality (download individual clips)
5. Add error recovery and retry logic
6. Implement cost tracking dashboard
7. Add analytics and monitoring (Sentry, Mixpanel)
8. Mobile responsive design
9. Accessibility improvements (ARIA, keyboard nav)
10. Documentation (user guide, API docs)

### Phase 2: Multi-Provider Integration (3-6 months)

**Goals**: Intelligent AI provider routing and cost optimization

**Tasks**:
1. Implement model registry in Convex
2. Add HeyGen integration (avatar videos)
3. Add KlingAI integration (creative effects)
4. Add Veo3 integration (cinematic quality)
5. Implement complexity analysis for routing
6. Add cost estimation before generation
7. Implement quality assessment pipeline
8. Add retry with provider fallback
9. Implement batch processing optimization
10. Add provider health monitoring

### Phase 3: Enterprise Features (6-12 months)

**Goals**: Team collaboration, brand management, templates

**Tasks**:
1. Implement team workspaces (multi-tenant)
2. Add role-based access control
3. Implement real-time collaboration (cursors, comments, locks)
4. Add brand profile management
5. Implement asset library system
6. Add template marketplace (prompts, storyboards)
7. Implement approval workflows
8. Add usage analytics per team/user
9. Implement SSO for enterprise
10. Add audit logging

### Phase 4: Advanced Editing (12-18 months)

**Goals**: Professional-grade video editing capabilities

**Tasks**:
1. Integrate CapCut WebAssembly SDK
2. Implement multi-track timeline
3. Add transitions and effects library
4. Implement keyframe animation
5. Add audio editing tools
6. Implement proxy workflow for 4K
7. Add real-time preview rendering
8. Implement collaborative editing sessions
9. Add version control for projects
10. Implement server-side rendering for export

### Phase 5: Distribution Platform (18-24 months)

**Goals**: Multi-platform publishing and optimization

**Tasks**:
1. Implement format optimization engine
2. Add social media platform integrations (API)
3. Implement scheduling system
4. Add caption and metadata management
5. Implement thumbnail generation
6. Add analytics integration (cross-platform)
7. Implement batch export operations
8. Add distribution packages
9. Implement CDN for global delivery
10. Add performance tracking per platform

---

**Last Updated**: November 14, 2025
**PRD Alignment**: Prompt Parser 60% • Content Planner 45% • Generation Engine 40% • Composition Layer 25% • Output Handler 5%
