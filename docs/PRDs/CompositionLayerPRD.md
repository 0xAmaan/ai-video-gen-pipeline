# Composition Layer - Product Requirements Document

**Project**: Composition Layer - Browser-based timeline editor with AI regeneration and professional editing capabilities  
**Goal**: Empower creators to arrange clips, make fast edits with low-latency previews, and regenerate sequences using AI directly in the browser

**Note**: This system integrates with CapCut's web-based engine for advanced editing while maintaining our AI regeneration capabilities

---

## Core Architecture

**Hybrid Editing Pipeline:**

- WebAssembly-powered timeline with real-time preview
- CapCut SDK integration for advanced editing features
- Proxy-based editing for performance optimization
- AI regeneration hooks for selected segments
- Future: Native effects processing and custom shader support

**Technical Foundation:**

- WebAssembly (via CapCut's compiled C++ engine)
- WebCodecs API for hardware-accelerated decoding
- WebGL for compositing and effects
- IndexedDB for local project caching
- Canvas API for auxiliary rendering

---

## User Stories

### Primary User: Video Editors and Content Creators

- As a video editor, I want to **arrange clips on a multi-track timeline** so that I can create complex compositions
- As a content creator, I want to **preview edits in real-time** so that I can iterate quickly
- As an editor, I want to **apply transitions between clips** so that my video flows smoothly
- As a creator, I want to **regenerate specific segments with AI** so that I can improve weak sections
- As a team member, I want to **collaborate on edits in real-time** so that we can work efficiently

### Secondary User: Marketing Teams and Agencies

- As a marketing manager, I want to **make quick adjustments without learning complex software** so that I can maintain campaign momentum
- As an agency producer, I want to **export in multiple formats simultaneously** so that I can deliver to various platforms

---

## Key Features

### 1. Authentication System

**Must Have:**

- Clerk authentication integration
- Project-based access control
- CapCut account linking (optional)
- Workspace management
- Edit history tracking per user

**Permission Structure:**

- Owner: Full editing and project control
- Editor: Can edit timeline and regenerate
- Reviewer: Can comment and preview only
- Viewer: Read-only preview access

**Success Criteria:**

- Seamless SSO with existing accounts
- Clear permission boundaries
- Secure project isolation
- Complete edit attribution

### 2. Timeline Interface

**Must Have:**

- Multi-track support (minimum 10 video, 10 audio tracks)
- Zoom and pan navigation (1 second to 1 hour view)
- Snap-to-grid with adjustable resolution
- Magnetic timeline with ripple editing
- Waveform visualization for audio tracks

**Timeline Components:**

- Track headers with solo/mute controls
- Clip thumbnails with automatic generation
- Playhead with frame-accurate positioning
- Time ruler with adjustable scale
- Track height adjustment

**Success Criteria:**

- Smooth scrubbing at 60fps
- Instant clip selection response
- No lag with 100+ clips
- Frame-accurate positioning
- Responsive zoom/pan controls

### 3. CapCut Engine Integration

**Must Have:**

- WebAssembly module loading and initialization
- SIMD optimization for performance
- WebGL compositing pipeline
- WebCodecs for media handling
- Memory management optimization

**CapCut Features:**

- Real-time preview rendering
- Hardware acceleration support
- Effects and filter processing
- Transition rendering
- Audio processing pipeline

**Success Criteria:**

- Engine loads in under 3 seconds
- 30fps preview for 1080p content
- Smooth playback with 5+ layers
- Effects render in real-time
- Memory usage under 2GB

### 4. Proxy Editing System

**Must Have:**

- Automatic proxy generation for 4K+ content
- Low-resolution preview files (480p/720p)
- Seamless proxy switching
- Background proxy creation
- Smart cache management

**Proxy Pipeline:**

- Detect high-resolution imports
- Generate optimized proxies via Workers
- Store in IndexedDB/cloud
- Switch between proxy/original
- Export uses original media

**Success Criteria:**

- 4K footage edits smoothly
- Proxy generation under 1x realtime
- Automatic quality switching
- Storage optimization achieved
- No quality loss on export

### 5. Clip Operations

**Must Have:**

- Trim in/out points with handles
- Split clips at playhead
- Copy/paste/duplicate functionality
- Speed ramping (0.25x to 4x)
- Reverse playback capability

**Advanced Operations:**

- Multi-clip selection and grouping
- Linked audio/video clips
- Cross-track editing
- Slide, slip, and roll edits
- Three-point editing

**Success Criteria:**

- Operations execute instantly
- Undo/redo maintains full state
- Multi-selection works smoothly
- Speed changes preserve sync
- No drift in long timelines

### 6. Transitions and Effects

**Must Have:**

- 50+ built-in transitions via CapCut
- Drag-and-drop application
- Duration adjustment handles
- Real-time preview
- Keyframe animation support

**Effect Categories:**

- Basic cuts and fades
- Wipes and slides
- 3D transitions
- Motion blur effects
- Custom shader effects

**Success Criteria:**

- Transitions render in real-time
- Smooth parameter adjustment
- Preview updates immediately
- Keyframes interpolate correctly
- Effects stack properly

### 7. AI Regeneration Interface

**Must Have:**

- Select segments for regeneration
- Prompt input for modifications
- Model selection interface
- Side-by-side comparison view
- One-click replacement

**Regeneration Workflow:**

- Mark in/out points on timeline
- Describe desired changes
- Choose generation model/quality
- Preview regenerated segment
- Accept or retry generation

**Success Criteria:**

- Clear segment selection
- Prompt interface is intuitive
- Generation integrates seamlessly
- Comparison view is responsive
- Replacement maintains timing

### 8. Audio Editing

**Must Have:**

- Volume control with keyframes
- Basic EQ and compression
- Fade in/out curves
- Audio ducking automation
- Sync lock with video

**Audio Features:**

- Waveform display in timeline
- Peak level indicators
- Audio effects (via CapCut)
- Voice-over recording
- Music beat detection

**Success Criteria:**

- Audio remains in sync
- Effects process in real-time
- Waveforms draw quickly
- Volume automation is smooth
- No audio artifacts

### 9. Real-Time Collaboration

**Must Have:**

- Live cursor tracking via Convex
- Simultaneous multi-user editing
- Conflict resolution for edits
- Chat and comments in timeline
- Change notifications

**Collaboration Features:**

- User presence indicators
- Section locking mechanism
- Real-time preview sharing
- Version branching
- Merge capabilities

**Success Criteria:**

- Updates appear within 100ms
- No edit conflicts or overwrites
- Clear user attribution
- Smooth cursor movement
- Stable with 5+ users

### 10. Export and Delivery

**Must Have:**

- Multiple format export (MP4, MOV, WebM)
- Resolution options (720p to 4K)
- Bitrate control
- Platform presets (YouTube, Instagram, TikTok)
- Batch export capability

**Export Pipeline:**

- Server-side rendering for quality
- Client-side for quick previews
- Progress tracking
- Queue management
- Direct platform upload

**Success Criteria:**

- Export at 2x realtime minimum
- Quality matches preview
- All formats work correctly
- Upload integration seamless
- Batch processing efficient

---

## Data Model

### Convex Collection: `projects`

**Document Structure:**

```json
{
  "projectId": "prj_abc123xyz",
  "name": "Summer Campaign Edit",
  "owner": "usr_123456",
  "team": ["usr_789", "usr_012"],
  "timeline": {
    "duration": 30.5,
    "framerate": 30,
    "resolution": "1920x1080",
    "tracks": [
      {
        "trackId": "trk_v1",
        "type": "video",
        "name": "Main",
        "clips": [
          {
            "clipId": "clp_001",
            "mediaId": "med_123",
            "in": 0,
            "out": 5.5,
            "start": 0,
            "duration": 5.5,
            "speed": 1.0,
            "effects": ["fade_in"],
            "position": {"x": 0, "y": 0},
            "scale": 1.0
          }
        ]
      },
      {
        "trackId": "trk_a1",
        "type": "audio",
        "name": "Music",
        "clips": [
          {
            "clipId": "clp_a001",
            "mediaId": "med_audio_456",
            "in": 0,
            "out": 30.5,
            "start": 0,
            "volume": 0.8,
            "keyframes": [
              {"time": 0, "value": 0.5},
              {"time": 5, "value": 0.8}
            ]
          }
        ]
      }
    ]
  },
  "media": {
    "med_123": {
      "type": "video",
      "name": "intro_clip.mp4",
      "url": "storage_url",
      "proxyUrl": "proxy_storage_url",
      "duration": 10.5,
      "resolution": "3840x2160",
      "fileSize": 156789000
    }
  },
  "capcut": {
    "engineVersion": "2.5.0",
    "projectData": "serialized_capcut_data",
    "lastSync": "timestamp"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "version": 15
}
```

### Convex Collection: `editorSessions`

```json
{
  "sessionId": "ses_xyz789",
  "projectId": "prj_abc123xyz",
  "activeUsers": [
    {
      "userId": "usr_123456",
      "displayName": "John Editor",
      "color": "#FF5733",
      "cursor": {
        "time": 15.5,
        "track": "trk_v1"
      },
      "selection": {
        "clips": ["clp_001"],
        "range": {"in": 2.5, "out": 4.5}
      },
      "lastActivity": "timestamp"
    }
  ],
  "locks": [
    {
      "clipId": "clp_002",
      "userId": "usr_789",
      "timestamp": "timestamp",
      "expires": "timestamp"
    }
  ],
  "playbackState": {
    "playing": false,
    "position": 12.5,
    "loop": {"enabled": true, "in": 5, "out": 15}
  },
  "createdAt": "timestamp",
  "expiresAt": "timestamp"
}
```

### Convex Collection: `renderJobs`

```json
{
  "jobId": "rnd_abc123",
  "projectId": "prj_abc123xyz",
  "type": "export",
  "settings": {
    "format": "mp4",
    "codec": "h264",
    "resolution": "1920x1080",
    "bitrate": 10000,
    "framerate": 30,
    "platform": "youtube"
  },
  "segments": {
    "total": 30,
    "completed": 15,
    "current": 16
  },
  "status": "processing",
  "progress": 0.5,
  "estimatedCompletion": "timestamp",
  "output": {
    "url": null,
    "size": null
  },
  "error": null,
  "createdBy": "usr_123456",
  "createdAt": "timestamp",
  "completedAt": null
}
```

---

## Recommended Tech Stack

**Frontend:** Next.js 16.0.3 with App Router + React 19.2.0 + TypeScript 5  
**Timeline Engine:** CapCut WebAssembly SDK (via Emscripten)  
**Media Processing:** WebCodecs API + WebGL + Canvas API  
**Storage:** IndexedDB for local cache + Convex for cloud persistence  
**Real-time:** Convex for collaboration and state sync  
**Authentication:** Clerk for user management  
**Development:** Turbopack for fast builds  
**Runtime:** Bun for performance  

**Rationale:** CapCut's proven WebAssembly engine provides professional editing capabilities while Convex enables real-time collaboration. This combination delivers desktop-class editing in the browser.

---

## Out of Scope

### Features NOT Included:

- 3D editing and compositing
- Motion tracking
- Color grading suite
- Advanced audio mixing console
- Multi-cam editing
- 360-degree video support
- HDR editing
- Plugin system

### Technical Items NOT Included:

- Desktop application
- Mobile app development
- Offline-only mode
- Custom codec development
- Hardware control surfaces
- External monitor support
- Render farm integration
- Legacy format support

---

## Known Limitations & Trade-offs

1. **Browser Memory**: Limited to 4GB in most browsers, affecting project size
2. **Performance**: 4K editing requires proxy workflow for smooth playback
3. **Concurrent Editors**: Maximum 10 simultaneous editors for stability
4. **Timeline Length**: Practical limit of 60 minutes for performance
5. **Track Count**: Maximum 20 video + 20 audio tracks
6. **Effect Stacking**: Maximum 10 effects per clip
7. **Undo History**: Limited to 100 operations
8. **Export Speed**: Server-side limited to 2x realtime

---

## Success Metrics

1. **Timeline responsiveness maintains 60fps** with 50+ clips
2. **Preview playback achieves 30fps** for 1080p content
3. **AI regeneration completes in under 2 minutes** for 30-second segments
4. **Export time under 30 seconds** for 1-minute 1080p video
5. **Collaboration sync latency under 100ms** for all operations
6. **User can complete basic edit in under 10 minutes**

---

## Testing Checklist

### Core Functionality:

- [ ] Timeline loads and displays correctly
- [ ] Clips can be added and arranged
- [ ] Playback works smoothly
- [ ] Audio remains in sync
- [ ] Export produces correct output

### CapCut Integration:

- [ ] Engine initializes properly
- [ ] Effects render correctly
- [ ] Transitions work smoothly
- [ ] WebAssembly loads efficiently
- [ ] Memory management stable

### Collaboration Features:

- [ ] Multiple users can edit simultaneously
- [ ] Changes sync in real-time
- [ ] Conflicts resolve correctly
- [ ] Cursors track smoothly
- [ ] Comments appear instantly

### AI Features:

- [ ] Segment selection works correctly
- [ ] Regeneration integrates seamlessly
- [ ] Model selection functions properly
- [ ] Comparison view displays correctly
- [ ] Replacement maintains timing

### Performance:

- [ ] 4K proxy editing is smooth
- [ ] 100+ clips remain responsive
- [ ] Memory usage stays under 2GB
- [ ] Export completes efficiently
- [ ] No memory leaks over time

---

## Risk Mitigation

**Biggest Risk:** Browser memory limitations affecting large projects  
**Mitigation:** Implement aggressive proxy strategy and segment-based loading; use streaming for preview instead of loading entire project

**Second Risk:** CapCut SDK integration complexity and maintenance  
**Mitigation:** Maintain abstraction layer for SDK; implement fallback to basic editing if SDK fails; regular SDK version testing

**Third Risk:** Real-time sync causing edit conflicts  
**Mitigation:** Implement granular locking at clip level; use operational transforms for conflict resolution; provide clear visual feedback

**Fourth Risk:** Export quality not matching preview  
**Mitigation:** Use same rendering pipeline for preview and export; implement quality validation checks; provide preview-quality export option