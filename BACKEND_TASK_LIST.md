# Backend Task List – Project Redesign Shot Iteration

This checklist captures everything the backend needs so the next GPT‑5.1 Codex agent can implement the new scene planner → scene iterator → storyboard flow. The goal is to let the UI pages run entirely off Convex data, invoke Replicate’s nano‑banana model for shot iterations, and surface the user’s chosen shots everywhere (planner arrow, iterator rows, vertical media gallery, storyboard).

---

## 0. Pre‑flight & shared assumptions
- Confirm we always know the active `projectId` (URL param, query string, or shared context). Every redesign page (`/project-redesign/...`) must receive the same `projectId` so hooks can address the right Convex records.
- Update the “Create project” entry point (`app/project-redesign/home/page.tsx`) to call `api.projectRedesign.createRedesignProject`, then push to the planner route with the new `projectId`. Persist `workflowVersion: "v2_redesign"`.
- Teach `components/redesign/PageNavigation.tsx` to accept the `projectId` (and optional `shotId`) so its links keep users on the same project while switching between planner, iterator, and storyboard.
- Update `lib/types/redesign.ts` and `lib/hooks/useProjectRedesign.ts` whenever new queries/mutations are added below, so UI code has typed helpers.

---

## 1. Persist scenes & shots on the planner
1. **Replace fake data.** Remove `INITIAL_SCENES` in `app/project-redesign/scene-planner/page.tsx` and drive the UI from `useProjectScenes(projectId)` plus `useSceneShots(sceneId)`.
2. **Scene CRUD wiring.**
   - `handleAddScene` → `useCreateProjectScene`.
   - `handleUpdateSceneTitle/Description` → `useUpdateProjectScene`.
   - `handleDeleteScene` → `useDeleteProjectScene`.
   - Drag reordering should call the existing `api.projectRedesign.reorderScenes`.
3. **Shot CRUD wiring.**
   - `handleAddShot` → `useCreateSceneShot` with a sequential `shotNumber`.
   - `handleDeleteShot` → `useDeleteSceneShot`.
   - `handleUpdateShotText` should update both `sceneShots.description` (display copy) and `sceneShots.initialPrompt` (generation prompt) via `useUpdateSceneShot`.
4. **Shot reordering.** Add a new Convex mutation (`reorderSceneShots`) that accepts an array of `{ shotId, shotNumber }` per scene and patches each record. Call it when drag‑and‑drop finishes inside a scene.
5. **Shot metadata for UI.**
   - Expose `sceneNumber` and `shotNumber` so the card can render labels like “Shot 1.1”.
   - Store the Convex `shotId` on each rendered shot card; it will feed routing and the gallery later.
6. **Arrow + trash layout.** After wiring the backend data, add the green “enter iterator” arrow under the trash button. Its click handler should push to the iterator route (see Section 2) with this shot’s `shotId`.
7. **Selection indicator.** Display the green ✓ next to the shot number when `sceneShots.selectedImageId` is non‑null. (No extra schema needed; just read the field returned by Convex.)

---

## 2. Canonical iterator routing & data fetch
1. **Route shape.** Create a dynamic route such as `/project-redesign/[projectId]/scene-iterator/[shotId]/page.tsx` (or keep `/scene-iterator?shotId=` if you prefer query params, but pick one convention). Update the planner arrow and the `PageNavigation` links to include both `projectId` and `shotId` when appropriate.
2. **Shot bootstrap query.** Add a Convex query (e.g. `getShotWithScene`) that returns:
   - The shot record (`sceneShots`).
   - Its parent scene (`projectScenes`) so we can pull the “scene prompt”.
   - Any existing `shotImages` for the shot (grouped or raw).
   - The current `storyboardSelections` entry (if any) so we know whether the shot already has a chosen image.
3. **Iterator state hook.** In `lib/hooks/useProjectRedesign.ts`, add a helper like `useShotWithImages(shotId)` that stitches together the query above and groups `shotImages` by `iterationNumber` (you can reuse the existing `useGroupedShotImages` helper if you expose scene metadata alongside it).
4. **Auto-generation trigger.** In `app/project-redesign/scene-iterator/page.tsx`, replace the placeholder iteration data with:
   - Fetch grouped images for the shot.
   - If no iteration zero exists yet, immediately call the generation API from Section 3 (with `initial=true`). Show a pending state while results stream back so we never render empty placeholders.
5. **Green arrow back-link.** When `Submit Selected` succeeds (Section 4), redirect back to `/project-redesign/[projectId]/scene-planner` so the planner updates live.

---

## 3. Shot image generation service (nano-banana)
1. **New API route.** Add `app/api/project-redesign/generate-shot-images/route.ts`. Shape of `POST` body:
   ```ts
   {
     projectId: string;
     sceneId: string;
     shotId: string;
     // automatically derived:
     iterationNumber?: number; // omit for “auto increment”
     parentImageId?: string;   // when iterating from an existing variant
     fixPrompt?: string;       // optional user-provided delta
   }
   ```
2. **Prompt construction.**
   - Load the scene title/description and the shot prompt from Convex (`sceneShots.initialPrompt`).
   - Build a full prompt string like:
     ```
     Scene prompt: ...
     Shot prompt: ...
     Additional direction: ...   // only when fixPrompt exists
     ```
   - **Add a literal `TODO: add system prompt here for image generation`** near the system text so future work can drop in the missing system prompt.
3. **Model invocation.**
   - Instantiate Replicate once (see `app/api/generate-character-variations/route.ts` for setup).
   - Always target the `nano-banana` model (`lib/image-models.ts` / `lib/types/models.ts` already describe it). Update those metadata files if necessary to mark `supportsImageInput: true`.
   - For the “initial iteration”, run two predictions in parallel (pattern from `/app/api/generate-character-variations/route.ts:195-220`).
   - For refinements, call the same model but pass `image_input` pointing at the parent image URL along with the fix prompt.
   - Capture the Replicate prediction IDs (if available) so we can store them in `shotImages.replicateImageId` for debugging.
4. **Persisting results.**
   - Use `api.projectRedesign.batchCreateShotImages` to insert the variants. Stamp `iterationNumber` (0 for first batch, otherwise last iteration+1), `variantNumber` (0/1 for now), `iterationPrompt` (the combined text), `parentImageId` (when iterating), and default `isFavorite: false`.
   - Return the saved image docs to the client so the iterator can update immediately.
5. **Idempotency guard.** Skip generation if the client requests an initial batch but iteration 0 already exists; instead return the existing records. You can expose a `force` flag later if we need regeneration.
6. **Flow tracker + demo mode.** Mirror the instrumentation from other APIs:
   - Call `flowTracker.trackAPICall`, `trackTiming`, etc.
   - Honor the `x-demo-mode` headers via `getDemoModeFromHeaders`. In “no-cost” mode, return mock image rows rather than pinging Replicate.
7. **Error handling.** Bubble API errors back to the client using `apiError`. Make sure failing variants do not poison the rest of the batch (wrap each call in try/catch and filter out failures, similar to the character variation endpoint).

---

## 4. Image selection + Convex persistence
1. **Selection mutation.**
   - Create a helper (either inside the iterator page or in `lib/hooks/useProjectRedesign.ts`) that calls:
     1. `api.projectRedesign.updateSceneShot` to set `selectedImageId`.
     2. `api.projectRedesign.createStoryboardSelection` so we capture the choice in `storyboardSelections`.
   - Before marking the new favorite, clear any existing `shotImages.isFavorite` flags for this shot. Then set `isFavorite = true` on the newly chosen image via `api.projectRedesign.updateShotImage`.
2. **Submit button flow.**
   - When the user clicks “Submit Selected”, ensure a selected image exists (iteration index + variant). Call the helper above, await completion, push back to the planner, and reset iterator state (so re-entering the shot later shows the saved selection).
   - The button should stay disabled until at least one image is selected.
3. **Planner check marks.** Because `sceneShots.selectedImageId` is now real Convex data, the planner can immediately show the ✓ and disable the iterator arrow for completed shots if necessary.
4. **Storyboard gating button.** Use `useProjectProgress(projectId)` (already defined) to determine when `selectionProgress === 100%`. When true, show the new green button to the right of “Add Scene” that routes to `/project-redesign/[projectId]/storyboard`.

---

## 5. Chat-driven refinements (iterator rows)
1. **Hook ChatInput to backend.**
   - When the user highlights their “best of the row” image and submits a fix prompt, call the generation API with `parentImageId` and `fixPrompt`.
   - Disable the input + show a spinner until the API responds so the user can’t spam requests.
2. **Iteration rows.**
   - Replace the placeholder `iterations` state with actual grouped data from Convex. Each row should include `iterationPrompt` (show it between rows, as already designed) and `images[]`.
   - When new images are returned, append a fresh row to the UI. The next prompt bubble should display the fix prompt that produced them.
3. **Selection state.** Keep the currently highlighted image ID in state, not just “iteration + index”, so we can map back to `shotImages`. This is needed for both `Submit Selected` and the vertical gallery highlight.

---

## 6. Vertical media gallery feed (planner + iterator)
1. **Backend query.** Add a Convex query (`getProjectShotSelections`) that returns, for a project:
   - Each shot that has `selectedImageId`.
   - The linked `shotImages` document (image URL + iteration metadata).
   - Its parent scene title/number and shot number.
   - Timestamp to sort by selection order (use `storyboardSelections.updatedAt` or the chosen image’s `updatedAt`).
2. **Hook + component.**
   - Add `useProjectShotSelections(projectId)` in `lib/hooks/useProjectRedesign.ts`.
   - Build a new `VerticalMediaGallery` component under `components/redesign/` that subscribes to the hook and renders a stacked list of thumbnails. The component should:
     - Stay hidden when the hook returns an empty array.
     - Match the attached reference exactly: a column, images cropped to identical width, zero horizontal padding between items, subtle 4–8px vertical gaps, and a large rounded container (soft corners + slight shadow) so the stack looks like a minimal film strip.
     - Order entries newest→oldest (so “first chosen image on the top”).
     - Emit callbacks when a thumbnail is clicked so the caller can highlight the corresponding shot card or iteration row.
     - Provide hover/active styles (border glow + selection ring) so a clicked thumbnail clearly highlights both in the gallery and in the parent shot list.
3. **Usage.**
   - Mount the gallery on the right side of both planner and iterator layouts.
   - When the user clicks a thumbnail while on the planner, scroll or highlight the matching shot card.
   - When on the iterator, clicking a thumbnail should highlight the currently selected image if it belongs to the same shot, otherwise navigate to that shot’s iterator route.

---

## 7. Storyboard page hydration
1. **Replace mock data.** Delete `generateMockStoryboard()` usage in `app/project-redesign/storyboard/page.tsx`.
2. **Real data query.** Either reuse `useProjectScenes` + `useSceneShots` + the new selection query or create a dedicated Convex query (e.g. `getStoryboardRows`) that returns, per scene:
   - Scene metadata (title, number).
   - Array of shots with their prompt text, shot numbers, and the selected `shotImages` URL.
3. **Rendering.**
   - `components/redesign/StoryboardSceneRow.tsx` should consume the real data (parts = shots). Each part card should show the saved image and prompt rather than the placeholder info.
   - Ignore animation controls for now per the requirements; focus solely on showing the chosen stills.

---

## 8. Additional Convex + type updates
- Extend `convex/projectRedesign.ts` with any new queries/mutations discussed above. Remember to enforce auth (check that the current user owns the project) just like the existing handlers do.
- Update `convex/schema.ts` only if new fields are required (none are strictly needed right now, but double-check whether storing a “selectionTimestamp” on `sceneShots` or `storyboardSelections` would simplify gallery ordering).
- Re-run `npx convex codegen` if Convex demands it so `_generated/api` stays current.
- Update `lib/types/redesign.ts` with any helper interfaces (e.g. `ShotSelectionSummary`, `ShotWithScene`, etc.) so hooks and components remain type-safe.

---

## 9. Testing & verification
- **Unit/manual tests.**
  - Generate a project, add scenes/shots, and verify they persist after reload.
  - Open a shot in the iterator → confirm the first two images auto-generate and are saved under `shotImages`.
  - Iterate with a fix prompt → ensure new rows appear and `parentImageId` is set in Convex.
  - Submit a selection → planner shows ✓, gallery gains a thumbnail, storyboard row displays the image, and the “Go to Storyboard” CTA appears once all shots are done.
- **Error paths.** Simulate Replicate failures (e.g., unset API key). Confirm the API reports an error without inserting partial records, and the UI surfaces a retry option.
- **Demo mode.** Hit the new API with `x-demo-mode: no-cost` to ensure it short-circuits into mocked data (so workshops can use the flow without burning credits).
- **Concurrency.** Add defensive checks so two tabs picking the same shot don’t double-create iteration zero. The quick-win is to query for existing images before firing Replicate and to de-dupe by `iterationNumber`.

With these tasks complete, the next agent will have a clear path to wire the UI to Convex, generate nano-banana shots in parallel, surface selections in the planner/iterator/storyboard, and keep all three views in sync via the new vertical media gallery.
