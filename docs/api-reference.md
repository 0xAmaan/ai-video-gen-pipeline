# API Reference Overview

## Executive Summary
The repository now includes a comprehensive OpenAPI 3.1 specification that documents every Next.js API route and key Convex data models supporting the AI video generation workflow. Use `docs/openapi.yaml` as the canonical reference for request/response schemas, error contracts, and underlying persistence records. [12]

## Endpoint Coverage

### Questioning APIs
- `POST /api/generate-questions` – Produces 3–5 structured clarifying questions tailored to a project prompt, with fallback between Groq and OpenAI providers. [3]

### Storyboarding & Character APIs
- `POST /api/generate-storyboard` – Generates storyboard scenes, detailed visual prompts, and Leonardo Phoenix preview images. [4]
- `POST /api/generate-character-variations` – Creates character reference images across multiple FLUX Schnell configurations with cost reporting. [2]
- `POST /api/regenerate-scene` – Re-runs Leonardo Phoenix on a single scene using stored preferences or explicit style overrides. [7]

### Video Generation APIs
- `POST /api/generate-video-clip` – Converts a storyboard image and motion prompt into a WAN 2.5 video clip. [5]
- `POST /api/generate-all-clips` – Kicks off WAN-based predictions for each storyboard scene in parallel and returns per-scene tracking identifiers. [1]
- `POST /api/poll-prediction` – Polls Replicate for prediction completion, surfacing progress, final URLs, or failure diagnostics. [6]

### Operational Utilities
- `POST /api/test-speed` – Benchmarks Groq and OpenAI pathways for storyboard generation, capturing latency, token usage, and failures. [8]

## Data Model Reference
- Convex mutations and queries managing projects, scenes, clips, and workflow state are defined in `convex/video.ts` and align with the schemas embedded in the OpenAPI spec. [9]
- Editor project storage, history tracking, and listing endpoints reside in `convex/editor.ts`. [10]
- Source-of-truth table definitions and indexes are provided in `convex/schema.ts`, informing the `VideoProjectRecord`, `SceneRecord`, and related schemas within `docs/openapi.yaml`. [11][12]

## Next Steps
- Integrate the OpenAPI document with client tooling (e.g., Stoplight, Postman, typed SDK generation) to streamline consumption.
- Establish a validation step in CI to lint `docs/openapi.yaml` and keep runtime changes in sync with the specification.

## Sources
1. `app/api/generate-all-clips/route.ts`
2. `app/api/generate-character-variations/route.ts`
3. `app/api/generate-questions/route.ts`
4. `app/api/generate-storyboard/route.ts`
5. `app/api/generate-video-clip/route.ts`
6. `app/api/poll-prediction/route.ts`
7. `app/api/regenerate-scene/route.ts`
8. `app/api/test-speed/route.ts`
9. `convex/video.ts`
10. `convex/editor.ts`
11. `convex/schema.ts`
12. `docs/openapi.yaml`