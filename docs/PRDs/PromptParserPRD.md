# Prompt Parser: Creative Prompt Intake & Enrichment

### TL;DR

Prompt Parser interprets user-submitted video ad prompts, proactively asks clarifying questions, and enriches inputs with actionable metadata. Designed for creative teams and marketers, it automates and streamlines ad script submission to ensure accurate, rich, and AI-ready inputs for high-quality, on-brand video ad generation.

---

## Goals

### Business Goals

* Increase prompt submission to ad generation conversion rates by 30% within three months.

* Reduce manual creative clarification efforts by 50% via automated AI-driven enrichment.

* Improve data consistency for AI ad generation pipelines by enriching 90% of prompts with targeted metadata.

* Accelerate creative intake for campaigns, reducing script turnaround time by 40%.

* Boost customer satisfaction scores for creative teams using the ad generation suite.

### User Goals

* Simplify the process of submitting ad concepts and scripts.

* Ensure submitted prompts are clearly understood and actionable for downstream AI tools.

* Reduce back-and-forth clarifications with automated, intelligent follow-up questions.

* Allow direct input or override of key metadata for creative control.

* Access enriched and standardized prompts stored for future reuse or reference.

### Non-Goals

* Not responsible for the actual AI ad video generation (focus solely on intake & enrichment).

* Not a long-term script/editor platform; excludes granular video editing features.

* Does not provide multi-language prompt translation in the initial release.

---

## User Stories

**Persona: Creative Team Member**

* As a creative team member, I want to submit an initial ad concept prompt, so that I can quickly kick off new campaigns.

* As a creative team member, I want to clarify my intent through guided AI-generated questions, so that my ad scripts are accurately interpreted.

* As a creative team member, I want to view and edit the automatically enriched metadata before submission, so that I retain creative control.

* As a creative team member, I want to manually bypass some steps, so that I can submit inputs quickly when I'm confident they're clear.

**Persona: Marketing Manager**

* As a marketing manager, I want to standardize prompt inputs across my team, so that all creative briefs are consistent and ready for AI processing.

* As a marketing manager, I want to track which prompts are fully enriched, so that I can prioritize which assets are ready for production.

**Persona: AI/AdOps Admin**

* As an AdOps admin, I want enriched prompts stored in a searchable repository, so that I can retrieve and reuse high-performing scripts.

* As an AdOps admin, I want to monitor prompt completion and enrichment rates, so that quality is consistent throughout the pipeline.

---

## Functional Requirements

* **Prompt Parsing & Intake (Priority: High)**

  * *Initial Prompt Capture*: Accepts free-form ad concepts/scripts via a text input field.

  * *Natural Language Parsing*: Processes input with NLP to extract key components (e.g., product, call-to-action, style).

* **AI-Driven Clarification (Priority: High)**

  * *Dynamic Question Generation*: Based on incomplete/missing info, generates clarifying questions for the user.

  * *Interactive Dialogue System*: Presents follow-up queries and collects structured responses.

* **Metadata Enrichment (Priority: High)**

  * *Automatic Metadata Population*: Fills out fields such as tone, target audience, CTA, format, and product details using AI/NLP.

  * *Manual Metadata Edit/Override*: Users can review and modify any AI-suggested metadata before submission.

* **Manual Bypass & Submission (Priority: Medium)**

  * *Bypass Option*: Let users skip AI questions or submit as-is if confident.

  * *Validation Feedback*: Notify when metadata may be lacking for good AI results.

* **Storage & Integration (Priority: Medium)**

  * *Output Structuring*: Store enriched prompt and metadata for downstream pipelines (API/database).

  * *API Hooks*: Integrate with ad generation backend, enabling seamless handoff.

* **Front-End Experience (Priority: High)**

  * *React/TypeScript UI*: Polished, responsive interface for prompt intake and dialogue.

  * *Session Management*: Maintain state for multi-step clarification and edits.

---

## User Experience

**Entry Point & First-Time User Experience**

* Users access Prompt Parser via the main “New Video Ad Concept” button on the campaign dashboard.

* On first use, a brief onboarding popup introduces the guided prompt enrichment process (1–2 screens).

* Example prompts and a “Start” button orient users to begin.

**Core Experience**

* **Step 1:** User enters a free-form video ad concept or script in the provided text field.

  * Minimal friction UI: large input box, placeholder for examples.

  * Input is validated for length and basic content.

  * On submit, user receives confirmation the prompt is received.

* **Step 2:** AI analyzes input for missing details.

  * Clarifying questions appear conversationally in a side-panel or modal (e.g., “What’s the target audience?”).

  * Users select or enter answers; can skip any question.

* **Step 3:** AI enriches prompt with structured metadata—displays summary card (e.g., script, key product, intended platform, style, etc.).

  * Users can review and directly edit any field for accuracy or completeness.

  * UI highlights required vs. optional metadata.

* **Step 4:** User finalizes and submits the enriched prompt package.

  * Success message, confirmation that prompt is now AI-ready and stored.

  * Option to “create another prompt” or view all past prompts.

**Advanced Features & Edge Cases**

* Power users can toggle off AI guidance and submit metadata manually.

* When ambiguous or insufficient input is detected, prominent warnings are displayed.

* Autosave ensures data won’t be lost if the session disconnects.

* Handles API or enrichment errors gracefully with clear error states and retry options.

**UI/UX Highlights**

* High-contrast, accessible color schemes for readability.

* Responsive design for desktop and tablet workflows.

* Clear progress indicators for multi-step flows.

* Keyboard navigation and screen reader support.

* Editable metadata displayed in an intuitive card layout.

---

## Narrative

Creative teams and marketers juggle tight timelines and ever-evolving campaign needs. In a typical ad campaign kickoff, a creative lead drafts a prompt for a new promotional video, but the process stalls as back-and-forth clarifications arise—what’s the product? preferred audience? campaign feel? Weeks slip by, and creative intent is diluted through repetitive email threads.

Enter Prompt Parser. The creative lead drops their raw idea into the system. Instantly, the AI highlights missing info, asking for target demographic and desired tone in a conversational, no-nonsense way. The team edits auto-filled metadata, tweaking key fields to match campaign intent. Everything’s validated, AI-ready, and visible in a single view.

Now, scripts are enriched, standardized, and stored—ready for the AI video generator. Turnaround time shrinks. Creative intent is preserved. Marketers work smarter, not harder, launching campaigns faster while staying on-message. The Prompt Parser quietly powers this transformation—reducing manual toil and helping teams focus on actual storytelling.

---

## Success Metrics

### User-Centric Metrics

* Adoption rate: number of unique users employing Prompt Parser weekly.

* Session completion: percentage of initiated journeys that reach submission.

* User satisfaction: periodic in-app ratings and Net Promoter Score (NPS).

* Manual bypass usage: % of users skipping AI clarification (actionable UX feedback).

### Business Metrics

* Increased throughput: number of AI-ready scripts per month.

* Time-to-production: average time from concept intake to AI pipeline handoff.

* Error reduction: decrease in manual correction interventions by ops/creative leads.

### Technical Metrics

* API response time: Average response <2 seconds.

* Front-end error rate: <1% session failures or crashes.

* Data loss incidents: Zero unsaved sessions under typical usage.

### Tracking Plan

* Prompt submission started

* Prompt clarification question displayed/answered/skipped

* Metadata auto-filled vs. manually edited

* Final enriched prompt submitted

* Manual bypass invoked

* Errors encountered/handled

* Session completion/abandonment

---

## Technical Considerations

### Technical Needs

* Front-End: React with TypeScript for the dynamic, interactive prompt/intake interface.

* Back-End API: REST/GraphQL endpoint to receive prompts, return clarifying questions, and store enriched output.

* AI/NLP Service: Integrated engine (internal or via partner) for parsing and generating metadata/questions.

* Session Storage: Temporary state for in-progress prompt enrichment (can use local storage/session backend).

* Database: Persistent storage for standardized, enriched prompts (with relevant schema).

### Integration Points

* Backend ad generation API: Seamless prompt transfer post-enrichment.

* Authentication system: Enforce access control (tie to existing user accounts).

* Analytics provider: For event and session tracking.

### Data Storage & Privacy

* All prompt data encrypted in transit and at rest.

* Retains only necessary user and metadata for enrichment—no unnecessary PII.

* Clear data retention and deletion policy per organization.

* Compliant with major privacy frameworks (GDPR, CCPA) for user data handling.

### Scalability & Performance

* Designed to handle hundreds of concurrent users (initial phase).

* API endpoints optimized for rapid turnaround (<2s response time).

* Supports future scaling to thousands of sessions/day.

### Potential Challenges

* Ambiguous prompts may still require manual follow-up.

* AI-generated questions may occasionally be irrelevant or repetitive: requires quality tuning.

* Complex or lengthy prompt flows could impact UX—session management and autosave crucial.

* Maintenance of prompt/metadata schema as downstream requirements evolve.

---

## Milestones & Sequencing

### Project Estimate

* Small: 2–3 weeks from kickoff to functional MVP and user testing.

### Team Size & Composition

* Small Team: 2 total people

  * 1 Full-stack developer (front-end, backend/APIs, integration)

  * 1 Product/Design owner (UI/UX, user research, test coordination)

### Suggested Phases

**1. Interactive Intake MVP (Week 1)**

* Key Deliverables: Core prompt text input, basic parsing, display clarifying questions, local session storage.

  * Responsible: Developer, Product/Design owner (joint for UI mockups).

* Dependencies: Access to test AI/NLP clarification API (stub if needed).

**2. Metadata Enrichment & UI Polishing (Week 2)**

* Key Deliverables: AI metadata extraction, manual override UI, validation, and output structuring for API/backend.

  * Responsible: Developer (feature build), Product/Design owner (user flows).

* Dependencies: Database/API scaffolding ready for submission.

**3. Integration & User Testing (Week 3)**

* Key Deliverables: Full flow integration with storage, API hooks, analytics/events tracking, UX refinements, bug fixes, initial user cohort trial.

  * Responsible: Both (joint bug triage, user feedback).

* Dependencies: Access to ad generation backend, analytics provider set up.

**4. Launch & Feedback Refinement (Optional, Ongoing)**

* Key Deliverables: Deployment, real-world usage tuning, refining AI question set, tracking adoption metrics.

  * Responsible: Both, ongoing.

* Dependencies: Live usage data/feedback, stakeholder input.