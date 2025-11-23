# Audio Route Implementation Specification

## Overview
Add a new `/audio` route between `/storyboard` and `/editor` that generates background music using Google Lyria-2 via Replicate. This route calculates total video duration from master shots and generates a soundtrack that matches the vibe of the previously generated visual content.

**IMPORTANT**: This is MUSIC ONLY - NO voices, narration, or voiceover. Just background soundtrack/BGM.

---

## Route Information

### Route Path
- **New Route**: `/app/[projectId]/audio/page.tsx`
- **URL**: `/{projectId}/audio`
- **Position in Pipeline**: After `/storyboard`, before `/editor`

### Navigation Flow
```
/input → /scene-planner → /storyboard → /audio → /editor
```

---

## File Paths Reference

### Files to CREATE
- `/app/[projectId]/audio/page.tsx` - Main audio generation page
- `/app/api/generate-soundtrack/route.ts` - API endpoint for Lyria-2 music generation
- `/lib/music-prompt-generator.ts` - Utility to create music prompts from visual prompts

### Files to MODIFY
- `/app/[projectId]/storyboard/page.tsx` - Update "Next" button to navigate to `/audio` instead of `/editor`
- `/convex/schema.ts` - Add `soundtrackUrl` and `soundtrackPrompt` fields to `videoProjects` table
- `/app/archive/[projectId]/editor/page.tsx` - Load soundtrack from database on mount
- `/lib/audio-models.ts` - Add Lyria-2 model configuration (may already exist)

### Files to REFERENCE (read for context)
- `/convex/schema.ts` - Lines with `videoProjects`, `projectScenes`, `sceneShots`, `shotImages`, `videoClips`, `audioAssets`
- `/lib/hooks/useProjectRedesign.ts` - Hook for fetching project data
- `/app/api/generate-music/route.ts` - Existing music generation API (if different from new one)
- `/app/[projectId]/storyboard/page.tsx` - Lines showing how storyboard fetches and displays video clips
- `/app/archive/[projectId]/editor/page.tsx` - Lines showing audio asset loading logic

---

## Database Schema Changes

### Table: `videoProjects`
Add these fields to the existing `videoProjects` table definition:

```
soundtrackUrl: v.optional(v.string())          // Lyria-2 generated music URL
soundtrackPrompt: v.optional(v.string())       // Prompt used to generate soundtrack
soundtrackDuration: v.optional(v.number())     // Duration in seconds
soundtrackStatus: v.optional(v.string())       // "pending" | "generating" | "complete" | "failed"
```

### Table: `audioAssets` (existing)
Use the existing `audioAssets` table to store the soundtrack:
- `type`: Set to `"bgm"`
- `source`: Set to `"generated"`
- `provider`: Set to `"lyria-2"`
- `url`: Lyria-2 output URL
- `projectId`: Link to current project
- `metadata`: Store prompt, negative_prompt, seed, total_duration

---

## API Integration: Replicate Lyria-2

### Replicate Model
- **Model ID**: `google/lyria-2`
- **Documentation**: https://replicate.com/google/lyria-2

### Input Schema
```json
{
  "prompt": string (required) - Text description of desired music
  "negative_prompt": string (optional) - What to exclude
  "seed": integer (optional) - For reproducibility
}
```

### Expected Output
- Audio file URL (likely MP3 or WAV format)
- Duration metadata

### API Endpoint to Create
**Path**: `/app/api/generate-soundtrack/route.ts`

**Responsibilities**:
1. Receive `projectId` from request body
2. Fetch all master shots from database (shots with selected `shotImages`)
3. Calculate total video duration from `videoClips`
4. Build music prompt from visual prompts (see Prompt Generation Strategy)
5. Call Replicate API with `google/lyria-2` model
6. Poll prediction status until complete
7. Save soundtrack URL to `videoProjects.soundtrackUrl`
8. Create `audioAssets` record with `type: "bgm"`
9. Return soundtrack URL and metadata

---

## Duration Calculation Strategy

### Data Source
- Query all `videoClips` for the project that are marked as "master" shots
- Each `videoClip` has a `duration` field (in seconds)

### Calculation
```
totalDuration = SUM(videoClips.duration WHERE videoClips.isMasterShot = true)
```

### Usage
- Display total duration prominently in UI: "Generating soundtrack for {totalDuration}s video"
- Include duration context in Lyria-2 prompt: "Create a {totalDuration} second soundtrack..."
- Validate that generated audio matches expected duration (±2 seconds tolerance)

### Example Display
```
🎵 Total Video Duration: 24 seconds
📊 Breakdown:
  - Scene 1: 8s (3 shots)
  - Scene 2: 10s (4 shots)
  - Scene 3: 6s (2 shots)
```

---

## Prompt Generation Strategy

### Objective
Generate a music prompt that matches the **vibe, mood, and aesthetic** of the visual content without referencing specific visual elements.

### Input Data to Analyze
1. **Original User Prompt** (`videoProjects.prompt`) - Overall commercial concept
2. **Shot Descriptions** (`sceneShots.prompt`) - Individual shot vibes
3. **Scene Metadata** (`projectScenes.description`) - Scene-level context
4. **Image Generation Prompts** (`shotImages.prompt`) - Visual style descriptors

### Extraction Logic
From the visual prompts, extract:
- **Mood/Tone**: dramatic, uplifting, tense, playful, serene, epic
- **Pace**: fast-paced, slow-motion, energetic, calm, building
- **Genre/Style**: cinematic, modern, retro, minimalist, orchestral, electronic
- **Emotional Arc**: starts calm → builds tension, triumphant throughout, melancholic to hopeful

### Example Transformations

**Input (Visual Prompts)**:
```
User Prompt: "A luxury car commercial showcasing speed and elegance"
Shot 1: "Close-up of sleek black car hood, golden hour lighting, dramatic shadows"
Shot 2: "Fast panning shot of car racing through mountain roads, motion blur"
Shot 3: "Slow-motion shot of car stopping, dust particles in sunlight"
```

**Output (Music Prompt)**:
```
"Create a 24 second cinematic orchestral soundtrack with electronic elements.
Start with dramatic tension and building energy (0-10s), transition to fast-paced
driving rhythm with powerful percussion (10-18s), end with a triumphant resolution (18-24s).
Mood: luxury, speed, elegance. Style: modern cinematic with epic undertones."
```

### Prompt Template Structure
```
"Create a {duration} second {genre} soundtrack. {pacing_description}.
Mood: {mood_keywords}. Style: {style_descriptors}. {arc_description}."
```

### Negative Prompt Strategy
Based on visual prompts, exclude:
- "dialogue, speech, vocals, narration" (ALWAYS include)
- Mismatched genres (e.g., if luxury commercial, exclude "comedic, playful, childish")
- Jarring elements (e.g., if serene, exclude "harsh, aggressive, dissonant")

---

## UI/UX Flow

### Page Layout

**Header Section**:
- Page title: "Generate Soundtrack"
- Breadcrumb navigation showing current step
- Total video duration display (calculated from master shots)

**Main Content Area**:

1. **Duration Summary Card**
   - Show total duration in seconds
   - Breakdown by scene (scene name + duration)
   - Visual timeline preview (optional)

2. **Prompt Preview Section**
   - Display auto-generated music prompt (editable textarea)
   - Display auto-generated negative prompt (editable textarea)
   - "Regenerate Prompt" button to create alternative versions
   - Seed input field (optional, for reproducibility)

3. **Generation Controls**
   - "Generate Soundtrack" button (primary CTA)
   - Loading state during generation (show Replicate prediction status)
   - Progress indicator

4. **Preview Section** (after generation)
   - Audio player with waveform visualization
   - Duration indicator
   - Volume control
   - Download button
   - "Regenerate" button if user wants different vibe

**Footer Section**:
- "Back to Storyboard" button
- "Continue to Editor" button (enabled after soundtrack generated)

### States to Handle

1. **Initial Load**: Calculate duration, generate prompt, show ready state
2. **Generating**: Disable controls, show progress, poll Replicate status
3. **Complete**: Show audio player, enable "Continue to Editor"
4. **Error**: Show error message, allow retry
5. **Regenerating**: Keep previous audio, show new generation in progress

---

## Integration with Video Editor

### Data to Pass
When user navigates to `/editor`, ensure:
1. `videoProjects.soundtrackUrl` is populated
2. `audioAssets` record exists with `type: "bgm"`
3. Soundtrack duration matches video duration

### Editor Loading Logic
Modify `/app/archive/[projectId]/editor/page.tsx`:

**On Mount**:
1. Query `audioAssets` WHERE `type = "bgm"` AND `provider = "lyria-2"`
2. If soundtrack exists, load into BGM track
3. Set default volume to 0.5 (50%)
4. Set `timelineStart: 0` to sync with video start
5. Apply `audioTrackSettings.audioBgm.volume` and `muted` state from project settings

**Audio Track Structure**:
```
Audio Tracks:
  - BGM (Background Music): Lyria-2 soundtrack (auto-loaded)
  - Narration: (empty, user can add later)
  - SFX: (empty, user can add later)
```

### Fallback Behavior
If user skips `/audio` route:
- Editor should still load normally
- BGM track is empty
- User can manually upload music or generate later

---

## Success Criteria

### Functional Requirements
- [ ] User can navigate from storyboard to new `/audio` route
- [ ] Page calculates and displays total video duration accurately
- [ ] Auto-generated music prompt matches visual vibe
- [ ] Lyria-2 API integration generates music successfully
- [ ] Generated soundtrack duration matches video duration (±10% tolerance)
- [ ] User can preview soundtrack before continuing
- [ ] User can edit and regenerate soundtrack
- [ ] Soundtrack automatically loads in editor BGM track
- [ ] User can skip audio route and proceed directly to editor (optional)

### UI/UX Requirements
- [ ] Loading states during generation are clear
- [ ] Error messages are helpful and actionable
- [ ] Audio player works correctly
- [ ] Duration breakdown is visually clear
- [ ] Navigation buttons are properly enabled/disabled based on state

### Technical Requirements
- [ ] Database schema updated with soundtrack fields
- [ ] API endpoint handles Replicate polling correctly
- [ ] Soundtrack URL persists in database
- [ ] Editor loads soundtrack without additional user action
- [ ] No breaking changes to existing routes

---

## Edge Cases to Handle

1. **No Master Shots Selected**: Show error, redirect back to storyboard
2. **Total Duration = 0**: Show error, cannot generate soundtrack
3. **Lyria-2 API Failure**: Show error, allow retry with same/different prompt
4. **Generated Audio Too Short/Long**: Warn user, allow regeneration
5. **User Navigates Away During Generation**: Save state, allow resume
6. **User Wants Different Soundtrack**: Provide "Regenerate" with new prompt
7. **User Skips Audio Route**: Editor should handle missing soundtrack gracefully

---

## Reference Code Patterns

### Replicate API Call Pattern
Look at `/app/api/generate-all-clips/route.ts` for:
- How to call Replicate with model ID
- Polling prediction status
- Handling async generation
- Error handling

### Project Data Fetching Pattern
Look at `/lib/hooks/useProjectRedesign.ts` for:
- How to query Convex for project data
- How to aggregate scene/shot/video data
- Reactive data updates

### Navigation Pattern
Look at `/app/[projectId]/storyboard/page.tsx` for:
- Next button implementation
- Route navigation with `useRouter()`
- Conditional rendering based on data state

### Audio Integration Pattern
Look at `/app/archive/[projectId]/editor/page.tsx` for:
- How audioAssets are loaded
- Audio track management
- Volume/mute controls

---

## Testing Checklist

### Manual Testing
1. Complete storyboard with 3 scenes, 9 shots, all videos generated
2. Navigate to `/audio` route
3. Verify duration calculation is correct
4. Verify music prompt reflects visual vibe
5. Click "Generate Soundtrack"
6. Wait for Replicate generation to complete
7. Preview soundtrack in audio player
8. Click "Continue to Editor"
9. Verify soundtrack loads in BGM track
10. Verify soundtrack plays in sync with video

### Edge Case Testing
1. Try with 1 scene, 1 shot (minimal duration)
2. Try with 10 scenes, 30 shots (long duration)
3. Navigate away during generation, come back
4. Regenerate soundtrack multiple times
5. Skip audio route entirely, verify editor still works

---

## Implementation Order (Suggested)

1. **Database Schema** (5 min)
   - Add fields to `videoProjects` in `/convex/schema.ts`

2. **API Endpoint** (30 min)
   - Create `/app/api/generate-soundtrack/route.ts`
   - Implement Replicate integration
   - Implement duration calculation
   - Test with Replicate API

3. **Prompt Generator Utility** (20 min)
   - Create `/lib/music-prompt-generator.ts`
   - Implement prompt extraction logic
   - Test with sample visual prompts

4. **Audio Route UI** (45 min)
   - Create `/app/[projectId]/audio/page.tsx`
   - Implement duration display
   - Implement prompt preview/editing
   - Implement generation controls
   - Implement audio player

5. **Navigation Updates** (10 min)
   - Update storyboard "Next" button
   - Add audio route to navigation

6. **Editor Integration** (20 min)
   - Update editor to load soundtrack on mount
   - Test audio track loading

7. **Testing & Polish** (30 min)
   - Manual testing of full flow
   - Edge case testing
   - UI polish and error handling

**Total Estimated Time**: ~2.5 hours

---

## Key Design Decisions

### Why Lyria-2 Only?
- Simplified UX (no model selection)
- Consistent quality
- Designed for soundtrack generation
- Good duration control

### Why Auto-Generate Prompt?
- Reduces user friction
- Ensures vibe consistency
- User can still edit if needed
- Leverages existing visual prompts

### Why Between Storyboard and Editor?
- Videos must be generated first (know duration)
- Editor should be for fine-tuning, not generation
- Logical progression: visuals → audio → editing

### Why BGM Only (No Narration)?
- Narration requires script, voice selection, lipsync
- BGM is simpler, higher ROI
- Can add narration later in editor
- Aligns with current branch scope (`audio_track`)

---

## Future Enhancements (Out of Scope)

- Multiple soundtrack variations to choose from
- Mood/genre selector UI instead of auto-generated prompt
- Beat markers synced to video cuts
- Soundtrack library (save/reuse across projects)
- Volume automation based on scene intensity
- Narration/voiceover generation (separate feature)
- SFX generation tied to specific shots