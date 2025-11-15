# Content Planner - Product Requirements Document

**Project**: Content Planner - Collaborative visual storyboarding and scene planning system for AI video campaigns  
**Goal**: Enable ad directors and marketing teams to transform campaign concepts into detailed visual storyboards through structured planning workflows

**Note**: This system bridges creative ideation and production, ensuring all stakeholders align on visual narratives before generation begins

---

## Core Architecture

**Storyboard Planning Pipeline:**

- Visual scene composition with drag-and-drop interface
- Asset organization system for media, graphics, and brand elements
- Collaborative annotation and feedback mechanisms
- Timeline-based narrative flow management
- Future: AI-powered scene suggestions and automatic shot composition

**Workflow Structure:**

- Concept brief ingestion from Prompt Parser
- Scene breakdown and sequencing
- Asset assignment and placeholder management
- Review cycles with stakeholder feedback
- Export to generation-ready specifications

---

## User Stories

### Primary User: Ad Directors and Creative Directors

- As an ad director, I want to **break down my concept into individual scenes** so that I can plan the visual flow
- As a creative director, I want to **assign specific assets to each scene** so that production has clear references
- As a creative team lead, I want to **annotate scenes with direction notes** so that my vision is clearly communicated
- As an art director, I want to **specify camera angles and movements** so that the dynamic feel is captured
- As a brand manager, I want to **review and approve storyboards** so that brand standards are maintained

### Secondary User: Marketing Managers and Stakeholders

- As a marketing manager, I want to **provide feedback on specific scenes** so that campaigns align with objectives
- As a stakeholder, I want to **track revision history** so that I understand how concepts evolved

---

## Key Features

### 1. Authentication System

**Must Have:**

- Integrated Clerk authentication
- Project-based access control
- Stakeholder permission levels
- Review and approval workflows
- Audit trail for all changes

**Permission Levels:**

- Owner: Full control over storyboard
- Editor: Can modify scenes and assets
- Reviewer: Can comment and approve
- Viewer: Read-only access

**Success Criteria:**

- Seamless permission management
- Clear role distinctions
- Secure project isolation
- Complete activity logging

### 2. Scene Composition Interface

**Must Have:**

- Grid-based storyboard layout (2x3, 3x4, custom)
- Drag-and-drop scene reordering
- Scene duration specification (seconds/frames)
- Thumbnail preview generation
- Scene numbering and labeling system

**Scene Components:**

- Visual placeholder/reference image
- Duration and timing markers
- Transition type specification
- Audio cue indicators
- Text overlay positions

**Success Criteria:**

- Smooth drag-and-drop interaction
- Instant visual feedback
- Responsive layout adaptation
- Clear scene relationships
- Intuitive navigation between scenes

### 3. Asset Management System

**Must Have:**

- Central asset library per project
- Support for images, videos, audio, graphics
- Cloud storage integration via Convex
- Asset tagging and categorization
- Quick search and filter capabilities

**Asset Types:**

- Stock footage references
- Brand assets (logos, graphics)
- Music and sound effects
- Voice-over scripts
- Color palettes and style guides

**Success Criteria:**

- Fast asset upload and processing
- Efficient search across large libraries
- Thumbnail generation for all media
- Seamless asset-to-scene assignment
- Version control for asset updates

### 4. Visual Annotation Tools

**Must Have:**

- Drawing tools for markup (arrows, circles, highlights)
- Text annotation with rich formatting
- Color coding for different feedback types
- Pin comments to specific scene regions
- Resolution tracking for feedback items

**Annotation Categories:**

- Composition notes (framing, layout)
- Motion direction (camera, object movement)
- Timing adjustments (pacing, duration)
- Brand compliance issues
- Creative suggestions

**Success Criteria:**

- Annotations remain precisely positioned
- Clear visual hierarchy of feedback
- Threaded discussion capability
- Status tracking (open/resolved)
- Notification system for updates

### 5. Timeline and Pacing Editor

**Must Have:**

- Visual timeline representation of full storyboard
- Scene duration adjustment via drag handles
- Beat marker placement for music sync
- Total runtime calculator
- Transition timing controls

**Timeline Features:**

- Scene grouping into acts/segments
- Audio waveform display
- Keyframe markers for important moments
- Pacing rhythm visualization
- Export timing sheets

**Success Criteria:**

- Real-time duration updates
- Smooth timeline scrubbing
- Accurate frame counting
- Clear visual relationships
- Precise timing control

### 6. Collaborative Review System

**Must Have:**

- Share links with controlled access
- Comment threads per scene
- Approval workflow stages
- Version comparison tools
- Notification system for updates

**Review Stages:**

- Draft (internal team review)
- Internal Review (creative team)
- Client Review (stakeholder feedback)
- Final Approval (sign-off ready)
- Locked (production ready)

**Success Criteria:**

- Clear approval status visibility
- Efficient feedback collection
- Stakeholder notification system
- Version control integrity
- Audit trail completeness

### 7. Template Library

**Must Have:**

- Pre-built storyboard templates by industry/platform
- Custom template creation from successful projects
- Template sharing within organization
- Variable placeholders for quick customization
- Style preset management

**Template Categories:**

- Platform-specific (TikTok, Instagram, YouTube)
- Industry verticals (retail, tech, healthcare)
- Campaign types (launch, seasonal, awareness)
- Duration variants (15s, 30s, 60s)
- Visual styles (minimal, dynamic, narrative)

**Success Criteria:**

- Quick template application
- Flexible customization options
- Template performance tracking
- Easy sharing mechanisms
- Version management

### 8. Export and Handoff

**Must Have:**

- Generation-ready JSON export with all specifications
- PDF storyboard export for offline review
- Shot list generation with technical details
- Asset package bundling
- Direct integration with Generation Engine

**Export Formats:**

- Structured data for AI generation
- Visual PDF presentations
- Excel shot lists
- Markdown documentation
- ZIP asset packages

**Success Criteria:**

- One-click export functionality
- Complete data preservation
- Format compatibility
- Batch export capability
- Handoff validation

### 9. AI-Powered Assistance

**Must Have:**

- Scene suggestion based on brief
- Auto-arrangement of scenes for narrative flow
- Shot type recommendations
- Transition suggestions between scenes
- Music beat matching assistance

**Success Criteria:**

- Relevant suggestions provided
- User control over AI assistance
- Quick suggestion generation
- Learning from user preferences
- Non-intrusive integration

---

## Data Model

### Convex Collection: `storyboards`

**Document Structure:**

```json
{
  "storyboardId": "stb_abc123xyz",
  "projectId": "proj_789",
  "title": "Summer Campaign 2025 - Social Cut",
  "briefId": "prm_reference123",
  "status": "in_review",
  "owner": "usr_123456",
  "team": ["usr_789", "usr_012"],
  "scenes": [
    {
      "sceneId": "scn_001",
      "order": 1,
      "title": "Opening - Brand Logo",
      "duration": 2.5,
      "thumbnail": "thumbnail_url",
      "composition": {
        "shotType": "wide_establishing",
        "cameraMovement": "slow_zoom_in",
        "depth": "shallow_focus"
      },
      "assets": {
        "primary": "asset_id_123",
        "secondary": ["asset_id_456", "asset_id_789"],
        "audio": "audio_id_001"
      },
      "annotations": [
        {
          "id": "ann_001",
          "type": "composition",
          "content": "Ensure logo has breathing room",
          "position": {"x": 0.5, "y": 0.3},
          "author": "usr_789",
          "status": "resolved"
        }
      ],
      "transitions": {
        "in": "fade",
        "out": "cut"
      },
      "metadata": {
        "colorPalette": ["#2ECC71", "#FFFFFF"],
        "mood": "energetic",
        "pace": "medium"
      }
    }
  ],
  "timeline": {
    "totalDuration": 30,
    "beatMarkers": [0, 7.5, 15, 22.5, 30],
    "acts": [
      {
        "name": "Introduction",
        "scenes": ["scn_001", "scn_002"],
        "duration": 7.5
      }
    ]
  },
  "reviews": {
    "currentStage": "client_review",
    "approvals": [
      {
        "stage": "internal_review",
        "approvedBy": "usr_456",
        "timestamp": "timestamp",
        "notes": "Ready for client"
      }
    ],
    "feedback": [
      {
        "id": "fb_001",
        "sceneId": "scn_003",
        "content": "Can we make this more dynamic?",
        "author": "usr_012",
        "timestamp": "timestamp",
        "resolved": false
      }
    ]
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "version": 3
}
```

### Convex Collection: `projectAssets`

```json
{
  "assetId": "ast_123xyz",
  "projectId": "proj_789",
  "type": "image",
  "name": "hero-product-shot.jpg",
  "url": "storage_url",
  "thumbnail": "thumbnail_url",
  "metadata": {
    "dimensions": {"width": 1920, "height": 1080},
    "fileSize": 2456789,
    "format": "jpeg",
    "colorProfile": "sRGB"
  },
  "tags": ["product", "hero", "primary"],
  "usedInScenes": ["scn_002", "scn_005"],
  "uploadedBy": "usr_123456",
  "uploadedAt": "timestamp",
  "version": 1,
  "status": "active"
}
```

### Convex Collection: `storyboardTemplates`

```json
{
  "templateId": "tpl_stb_001",
  "name": "Product Launch - Instagram Stories",
  "category": "product_launch",
  "platform": "instagram_stories",
  "duration": 15,
  "sceneCount": 5,
  "structure": [
    {
      "order": 1,
      "type": "hook",
      "duration": 2,
      "description": "Attention-grabbing opener",
      "suggestedShot": "close_up",
      "transition": "swipe"
    },
    {
      "order": 2,
      "type": "problem",
      "duration": 3,
      "description": "Problem identification",
      "suggestedShot": "medium",
      "transition": "cut"
    }
  ],
  "defaultAssets": {
    "music": "upbeat_electronic",
    "colorScheme": "vibrant",
    "typography": "modern_bold"
  },
  "usageStats": {
    "timesUsed": 156,
    "averageRating": 4.7,
    "conversionRate": 0.082
  },
  "createdBy": "usr_admin",
  "createdAt": "timestamp",
  "public": false
}
```

---

## Recommended Tech Stack

**Frontend:** Next.js 16.0.3 with App Router + React 19.2.0 + TypeScript 5  
**UI Components:** Radix UI + shadcn/ui + Tailwind CSS v4  
**Backend:** Convex for real-time collaboration and data persistence  
**Authentication:** Clerk for team management and permissions  
**AI Integration:** Vercel AI SDK for intelligent suggestions  
**Development:** Turbopack for fast development builds  
**Runtime:** Bun for package management  

**Rationale:** Real-time collaboration through Convex is essential for team storyboarding, while the modern React stack ensures smooth interaction for complex visual interfaces.

---

## Out of Scope

### Features NOT Included:

- Full video editing capabilities
- 3D scene composition
- Motion graphics creation
- Character animation tools
- Audio editing beyond basic trimming
- Live camera feed integration
- VR/AR scene planning
- Automated video generation at this stage

### Technical Items NOT Included:

- Desktop application development
- Offline mode with sync
- Custom rendering engine
- RAW image processing
- Video codec transcoding
- Direct camera control
- Hardware acceleration
- Plugin architecture

---

## Known Limitations & Trade-offs

1. **Scene Limit**: Maximum 50 scenes per storyboard for performance
2. **Asset Size**: Individual assets limited to 100MB
3. **Concurrent Editors**: Maximum 10 simultaneous editors per project
4. **Export Resolution**: PDF exports capped at 300 DPI
5. **Annotation Density**: Maximum 20 annotations per scene
6. **Timeline Duration**: Maximum 5-minute total duration
7. **Undo History**: Limited to last 50 actions
8. **Template Complexity**: Maximum 20 scenes per template

---

## Success Metrics

1. **Average storyboard completion time under 30 minutes** for standard projects
2. **90% of projects reach approval** within 3 review cycles
3. **Scene arrangement changes reduced by 60%** after initial setup
4. **Collaboration increases approval speed by 40%** versus email workflows
5. **Asset reuse rate above 70%** across projects
6. **Template adoption rate exceeds 50%** for new projects

---

## Testing Checklist

### Core Functionality:

- [ ] User can create new storyboard project
- [ ] Scenes can be added and arranged
- [ ] Assets upload and display correctly
- [ ] Timeline reflects scene durations

### Collaboration Features:

- [ ] Multiple users can edit simultaneously
- [ ] Comments appear in real-time
- [ ] Approval workflow progresses correctly
- [ ] Notifications trigger appropriately
- [ ] Version history tracks changes

### Visual Tools:

- [ ] Drag-and-drop works smoothly
- [ ] Annotations save positions correctly
- [ ] Thumbnails generate automatically
- [ ] Preview mode displays accurately
- [ ] Export formats maintain fidelity

### Integration Points:

- [ ] Imports brief from Prompt Parser
- [ ] Exports to Generation Engine format
- [ ] Asset library syncs properly
- [ ] Templates apply correctly
- [ ] Analytics track usage

### Performance:

- [ ] Large storyboards remain responsive
- [ ] Real-time sync has minimal latency
- [ ] Asset loading is optimized
- [ ] Search returns results quickly
- [ ] Exports complete within 10 seconds

---

## Risk Mitigation

**Biggest Risk:** Complex storyboards becoming unwieldy and slow  
**Mitigation:** Implement pagination and lazy loading for scenes; optimize rendering pipeline for large projects

**Second Risk:** Conflicting edits in collaborative sessions  
**Mitigation:** Implement scene-level locking during edit; provide clear visual indicators of active editors

**Third Risk:** Asset library becoming disorganized  
**Mitigation:** Enforce tagging standards; implement automatic organization and duplicate detection

**Fourth Risk:** Stakeholder feedback creating endless revision cycles  
**Mitigation:** Implement approval gates and deadline enforcement; provide clear revision limits