╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 UX Redesign Implementation Plan

 Overview

 Redesign the video pipeline app with a completely new user flow in /project-redesign/* routes, building a new design
  system based on shadcn/ui as the baseline.

 Phase 1: Design System Foundation (Start Here)

 Goal: Create reusable components and design tokens that all pages will use

 1.1 Design Tokens & Theme

 - Create lib/design-system/tokens.ts with new color palette, typography scale, spacing system
 - Extend Tailwind config with custom design tokens (keeping shadcn as baseline)
 - Define new animation/transition standards

 1.2 Core Reusable Components

 Build in components/redesign/:
 - ChatInput.tsx - Bottom input with voice-to-text button (used across multiple pages)
 - SceneCard.tsx - Colored scene cards with part indicators (wireframe #3, #6)
 - ImageGallery.tsx - 3-up image grid with selection states (wireframe #4)
 - ShotTimeline.tsx - Vertical shot list with color indicators (wireframe #3)
 - HorizontalStoryboard.tsx - Horizontal scene/part timeline (wireframe #6)

 1.3 Layout Components

 - RedesignLayout.tsx - Shared layout wrapper for all redesign pages
 - VisionPreview.tsx - Large preview container with "sick visual effect" placeholder

 ---
 Phase 2: Home Page (/project-redesign/home)

 Wireframe: Image #1 - Landing page with Vision preview + "Create with Vision" CTA

 Implementation Steps:

 1. Build Vision preview container (large centered area)
  2. Add "Create with Vision" button (routes to /project-redesign/[projectId]/scene-planner)
 3. Integrate visual effect placeholder (can be enhanced later)
 4. Add smooth entrance animations

 Components: VisionPreview, Button (shadcn extended)

 ---
 Phase 3: Projects Page (/project-redesign/projects)

 Wireframe: Image #2 - Grid of project cards with "add new project" button

 Implementation Steps:

 1. Create ProjectCard.tsx component (rounded, with project preview)
 2. Build responsive grid layout (2-4 columns based on viewport)
 3. Add "+ add new project" card (routes to /project-redesign/home or /scene-planner)
 4. Implement hover states and click interactions
 5. Connect to Convex to fetch actual projects

 Components: ProjectCard, Grid container

 ---
Phase 4: Prompt Planner Page (/project-redesign/[projectId]/scene-planner)

 Wireframe: Image #3 - Scene/shot editor with chat input

 Implementation Steps:

 1. Build left panel: vertical scene list with collapsible shots
 2. Build right panel: vertical colored shot indicators (green/red/blue)
 3. Integrate ChatInput at bottom (first real use of this component)
 4. Add scene/shot CRUD operations
 5. Implement auto-generated section (connects to AI prompt enhancement)
 6. Add voice-to-text functionality to ChatInput

 Components: SceneCard, ShotTimeline, ChatInput, CollapsiblePanel

 Complexity: HIGH - Most complex page with lots of interaction

 ---
 Phase 5: Iterator Page (/project-redesign/iterator)

 Wireframe: Image #4 & #5 - Image selection gallery

 Implementation Steps:

 1. Build top section: 3 images from original prompt
 2. Build middle section: 3 images from enhanced prompt
 3. Add image selection interaction (choose favorite for each scene/part)
 4. Show selected image in preview area below
 5. Integrate ChatInput for refinement ("What do you want to change...?")
 6. Add "Add asset" and "Shader gallery" controls
 7. Implement next/previous scene navigation

 Components: ImageGallery, ChatInput, ImagePreview

 ---
 Phase 6: Storyboard Page (/project-redesign/storyboard)

 Wireframe: Image #6 - Horizontal timeline view

 Implementation Steps:

 1. Build horizontal scrollable scene container
 2. Create scene grouping (Scene 1, Scene 2, etc. with radio buttons)
 3. Build part cards within each scene (Part 1, Part 2, Part 3 with color coding)
 4. Add cinematic/style popup controls
 5. Implement scene selection/navigation
 6. Connect to video generation pipeline

 Components: HorizontalStoryboard, SceneGroup, PartCard

 ---
 Phase 7: Integration & Polish

 7.1 Navigation Flow

 - Connect all page transitions
 - Add back/forward navigation where needed
 - Implement progress saving

 7.2 Responsive Design

 - Test all pages on mobile/tablet/desktop
 - Adjust layouts for different viewports
 - Ensure touch interactions work

 7.3 Animations & Transitions

 - Add page transition animations
 - Implement micro-interactions
 - Polish loading states

 ---
 Component Dependency Map

 Shared across pages:
 ├── ChatInput (scene-planner, iterator)
 ├── ImageGallery (iterator)
 ├── SceneCard (scene-planner, storyboard)
 └── RedesignLayout (all pages)

 Page-specific:
 ├── Home: VisionPreview
 ├── Projects: ProjectCard
 ├── PromptPlanner: ShotTimeline, CollapsiblePanel
 ├── Iterator: ImagePreview, AssetControls
 └── Storyboard: HorizontalStoryboard, PartCard

 ---
 Recommended Implementation Order

 1. Week 1: Design tokens + ChatInput + basic RedesignLayout
 2. Week 2: Home page + Projects page (validates design system)
 3. Week 3: Iterator page (simpler interaction model)
 4. Week 4: Storyboard page (moderate complexity)
 5. Week 5: Prompt Planner page (most complex)
 6. Week 6: Integration, polish, responsive testing

 ---
 Key Decisions Made

 - Routing: Separate /project-redesign/* routes (won't affect existing app)
 - Design System: New components in components/redesign/ using shadcn as baseline
 - Data: Reuse existing Convex schema/queries where possible
 - Migration: Build complete new flow, then can A/B test or hard cutover later

 ---
 Questions to Resolve During Implementation

 - Exact color palette for scene/part indicators (green/red/blue/brown in wireframes)
 - "Sick visual effect" for Vision preview - what technology? (Canvas, SVG, video?)
 - Voice-to-text provider (Whisper, browser API, other?)
 - Image generation - using existing Replicate integration?
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
