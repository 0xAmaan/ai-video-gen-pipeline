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

## Notes

- MediaBunny lives entirely in the demux worker to keep the main thread responsive. Reuse `mediaBunnyManager` rather than touching the worker directly.
- The editor state, media catalog, and undo/redo stacks are persisted to Convex for cloud sync and undo/redo functionality.
- The export pipeline currently writes a placeholder blob via the encode worker. A full WebCodecs muxer implementation is planned.
