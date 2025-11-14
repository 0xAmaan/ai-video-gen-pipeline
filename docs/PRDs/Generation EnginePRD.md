# Generation Engine: Parallel Video Model System (PRD)

### TL;DR

A parallel video model engine that routes briefs to the best generator(s) across providers like HeyGen, KlingAI, Veo3, and others—simultaneously—so marketers and ad directors can produce high-quality ad videos fast and cost-effectively. It automates asset flow, audio tagging, retries, and handoff while exposing a clear timeline/progress UI and a clean API. The result: more approved ads, faster cycles, lower cost per finished minute, and consistent brand safety.

---

## Goals

### Business Goals

* Reduce cost per finished minute of video by 30–50% within 90 days of launch, measured across all tenants.

* Achieve 95%+ on-time delivery for jobs under a 2-hour SLA at P95 latency for single-variant outputs.

* Increase approved-first-pass rate to 70%+ (outputs accepted without external editing) within 60 days.

* Drive 40% of generated videos to be multi-variant experiments (3+ variants) to increase win-rate in market tests.

* Reach 80%+ provider utilization with smart routing and fallbacks to minimize idle compute and vendor overage fees.

### User Goals

* Generate multiple high-quality video ad variants quickly with predictable budgets and deadlines.

* Maintain brand consistency and compliance via metadata, audio tagging, and automated QC checks.

* See live progress, costs, and ETA in a consolidated timeline; pause, cancel, or rerun specific branches.

* Reuse scripts, images, VO, and metadata across campaigns with versioning and lineage.

* Deliver assets directly to ad platforms, DAMs, or cloud storage with captions and multiple aspect ratios.

### Non-Goals

* Building a full non-linear video editor (NLE). Advanced frame-level editing is out of scope.

* Custom model training or fine-tuning in v1; we focus on orchestration and routing over existing providers.

* Live broadcast or real-time streaming production; this is a batch/near-real-time generation system.

---

## User Stories

Personas:

* Marketing Manager (MM)

* Ad/Creative Director (CD)

* Producer/Project Manager (PM)

* Brand Compliance Officer (BCO)

* Data Analyst (DA)

* Workspace Admin (WA)

Marketing Manager

* As a Marketing Manager, I want to upload a script and product images, so that I can quickly generate multiple ad variants for A/B testing.

* As a Marketing Manager, I want to set a budget cap and deadline, so that the system optimizes model choices without cost overruns.

* As a Marketing Manager, I want to export final cuts with captions and aspect ratios, so that I can publish to different channels without extra work.

Ad/Creative Director

* As an Ad Director, I want to compare variants side-by-side, so that I can select the most on-brief creative fast.

* As an Ad Director, I want to lock key scenes while rerunning only the weak ones, so that I preserve good segments and iterate efficiently.

* As an Ad Director, I want brand and tone metadata grounded in the brief, so that outputs stay on-message.

Producer/Project Manager

* As a Producer, I want a job timeline with per-model progress and ETA, so that I can manage expectations and unblock delays.

* As a Producer, I want to retry failed branches automatically on fallback providers, so that deadlines are met without manual intervention.

* As a Producer, I want webhook notifications, so that I can trigger downstream QC and delivery workflows.

Brand Compliance Officer

* As a Compliance Officer, I want automated audio tagging that detects music sources and VO language, so that I can verify rights and localization.

* As a Compliance Officer, I want content safety checks and logo usage validation, so that brand and regulatory standards are upheld.

Data Analyst

* As a Data Analyst, I want cost and success-rate analytics by provider and genre, so that we can negotiate better rates and refine routing rules.

* As a Data Analyst, I want to track approval rates per variant and channel, so that we can invest in the most effective creative.

Workspace Admin

* As an Admin, I want role-based access and per-team budgets, so that costs and permissions remain controlled.

* As an Admin, I want API keys with scopes and rate limits, so that integrations are safe and auditable.

---

## Functional Requirements

* Input & Briefing (Priority: P0) -- Brief Intake: Script upload, product images/video, brand kit (logo, fonts/colors), and key messages. -- Metadata Tags: Audience, channel, length, tone, compliance flags, required/forbidden elements. -- Constraints: Budget cap, deadline, quality profile, number of variants, aspect ratios.

* Parallel Model Orchestrator (Priority: P0) -- Model Registry: Catalog of providers (HeyGen, KlingAI, Veo3, others) with declared capabilities, cost, speed, and quality scores. -- Intelligent Routing: Rule- and signal-based routing based on brief metadata, budget, deadlines, and historical performance. -- Parallelization: Simultaneous dispatch to multiple providers for variant generation; configurable concurrency per tenant. -- Health & Warmup: Provider health checks, pre-warm pools, rate-limit awareness, and backoff strategies. -- Fallbacks & Reruns: Automatic retry on alternative providers; partial reruns for specific scenes or tracks. -- Versioning: Pin model/provider versions per job for reproducibility; seed management for deterministic reruns.

* Integrations (Priority: P0) -- Providers: HeyGen (talking-head and VO), KlingAI (cinematic T2V), Veo3 (high-fidelity T2V), plus optional Runway/Pika/Stability/ElevenLabs. -- Delivery: DAMs (e.g., Brandfolder/Bynder), cloud buckets (S3/GCS/Azure), and ad platforms via export bundles. -- Notifications: Webhooks, email, Slack/Teams. -- Auth: OAuth/API key storage with rotation and scoped permissions.

* Asset Flow & Storage (Priority: P0) -- Asset Graph: Track lineage between scripts, images, audio, scenes, and final outputs; versioning across iterations. -- Storage: Content-addressable storage with regional replication; signed URLs; CDN-backed downloads. -- Checksums & Watermarks: Integrity checks and optional invisible watermarking of generated content.

* Audio Management & Tagging (Priority: P0) -- Audio Tagging: Detect VO language, music presence/source, SFX classes; profanity/loudness checks. -- VO & TTS: Selection from integrated providers; voice cloning where available (with consent tracking). -- Alignment: Lip-sync alignment hints for talking-head outputs; beat detection for cut timing. -- Loudness & Mix: Normalize to target LUFS; ducking for VO-over-music.

* Timeline & Progress UI (Priority: P0) -- Job Overview: Gantt-style timeline of branches per provider, with statuses, ETA, and cost projections. -- Controls: Pause, cancel, rerun per branch; cap spend during execution; approve/lock scenes. -- Logs: Human-readable logs and raw provider responses for debugging.

* Review & QA (Priority: P1) -- Automated QC: Duration bounds, black frames, flicker detection, speech intelligibility, logo presence. -- Review Tools: Frame-accurate comments, scene ratings, A/B side-by-side, diff of iterations.

* Delivery & Handoff (Priority: P0) -- Exports: MP4/MOV, captions (SRT/VTT), thumbnails, and social-ready aspect ratios (9:16, 1:1, 16:9). -- Packaging: Shot lists, scripts, and rights report bundled; push to DAM/storage; publish webhooks.

* Policy & Safety (Priority: P0) -- Content Filters: Safety/classification gates based on brief and brand requirements. -- Rights & Consent: Track third-party content rights, VO consent, and usage windows.

* Admin, Billing & Governance (Priority: P1) -- RBAC & SSO: Roles (Viewer, Editor, Approver, Admin) and SSO integration. -- Metering & Budgets: Real-time spend meter, monthly caps, cost reports by team/campaign. -- Audit: Full activity log and immutable job audit trail.

* Public API (Priority: P0) -- Endpoints: Create job, upload assets, submit brief, get status, stream logs, list outputs, trigger reruns, export assets. -- Webhooks: Job.created, job.updated, branch.completed, qc.failed, export.ready; idempotency and signature verification. -- Limits: Pagination, rate limiting, retry-after headers, idempotency keys.

* Observability (Priority: P0) -- Metrics: Provider latency, success rates, error codes; cost per job/variant; cache hit rates. -- Tracing: Distributed tracing for job flows; correlation IDs across providers.

* Localization (Priority: P2) -- Multi-language VO and subtitles; per-locale variants and compliance checks.

---

## User Experience

* End-to-end journey for marketers and ad directors

Entry Point & First-Time User Experience

* Users access via invite link or SSO from the marketing tool suite; landing on “Create New Ad.”

* Onboarding wizard introduces: brief structure, routing overview, and budget & deadline controls (2–3 screens, skippable).

* Starter templates for common ad types (UGC talking-head, product explainer, cinematic intro).

Core Experience

* Step 1: Create Brief

  * User enters title, selects ad type, uploads script (or writes inline), and adds product images/video.

  * UI guides required metadata: audience, channel, tone, aspect ratios, length target.

  * Validation: required fields, asset formats, script length; inline errors show fixes.

  * Success: brief saved as Draft; user sees estimated cost/time based on current routing profile.

* Step 2: Configure Constraints

  * User sets budget cap, deadline, number of variants, and quality profile.

  * UI displays cost/time tradeoffs; recommends providers for the brief.

  * Errors if budget cannot meet constraints; offer auto-adjust (fewer variants or extended deadline).

* Step 3: Audio Setup

  * Choose VO source (upload/TTS/cloned voice) and background music from library or none.

  * Audio tagging preview identifies language, potential issues (e.g., profanity), and loudness.

  * Success: audio assets attached with alignment hints.

* Step 4: Review Routing Plan

  * Timeline pre-visualization of model branches: e.g., 2x Veo3 cinematic variants, 1x KlingAI, 1x HeyGen talking-head.

  * Display per-branch ETA and projected cost; user can lock/unlock branches, reorder, or add/remove providers.

* Step 5: Launch Generation

  * Click “Generate.” Orchestrator dispatches parallel jobs; UI shows live timeline with statuses.

  * Real-time updates: queueing, rendering, stitching, QC; logs expandable per branch.

  * Error handling: automatic retry/fallback indicated with reason; user can override or pause.

* Step 6: Review Variants

  * Grid + side-by-side compare; per-variant scorecards (duration, QC results, costs, notes).

  * User locks preferred scenes; selectively reruns weak scenes or requests an extra variant within remaining budget.

* Step 7: Approvals & Captions

  * Approver role confirms final cut; system generates captions (SRT/VTT) and burns in if requested.

  * Language variants offered if localization enabled; VO swapping with smart re-timing.

* Step 8: Delivery & Handoff

  * Export presets: TikTok, Instagram, YouTube, CTV; aspect ratio-specific outputs with safe margins.

  * Assets packaged with rights report and pushed to DAM/storage; webhook fires to notify downstream teams.

Advanced Features & Edge Cases

* Budget Exhaustion: System pauses non-critical branches and prompts to increase budget or reduce variants.

* Provider Outage: Automatic rebalancing to available providers; user notified with revised ETA.

* Lip-Sync Mismatch: Auto-detect and re-time; fallback to alternative VO or provider with better alignment.

* Compliance Fail: QC flags content; user receives guided fixes (swap music, remove flagged frame) or one-click rerun with adjusted constraints.

* Long Scripts: Suggest scene splits; partial generation per scene to enable quicker iteration.

* Asset Rights Conflict: Halt export until rights metadata completed; provide checklist.

UI/UX Highlights

* Color-coded statuses (Queued, Rendering, QC, Needs Attention, Done); accessible contrast ratios.

* Gantt-style timeline with per-branch tooltips: current step, ETA delta, spend-to-date.

* Keyboard shortcuts for review (space to play/pause, 1–5 to rate scenes).

* Scene-based navigation; lock icons for preserved segments; breadcrumb for lineage.

* Responsive layout with offline-ready uploads and resumable transfers; drag-and-drop assets.

* Clear privacy cues when voice cloning or external providers are used; consent banners and policy links.

---

## Narrative

Sofia, a Creative Director at a consumer brand, faces a tight deadline: launch a social-first video campaign for a new product line by tomorrow. She has a strong script, a product shoot, and an approved brand kit, but the agency’s edit bay is backed up. She needs multiple creative directions fast—talking-head UGC for TikTok, a cinematic opener for YouTube, and square variants for Instagram—without blowing her budget.

She opens the Generation Engine and completes a brief in minutes, attaching images, VO guidance, and tone metadata. The system proposes a parallel plan: two cinematic variants via Veo3, one stylized cut via KlingAI, and a UGC-style talking-head via HeyGen, all within her budget and a two-hour window. She launches. The timeline animates as each branch progresses, with automated audio tagging confirming rights, loudness, and language. One provider hits a rate limit; the system quietly reroutes, preserving the deadline.

When renders finish, Sofia compares variants side-by-side with QC scorecards. She locks two strong scenes and reruns a weak segment only, conserving spend. Captions generate automatically; aspect ratios are packaged with safe margins. With a click, assets are pushed to the brand’s DAM and a webhook alerts the media team. Sofia meets the deadline with three polished options, at half the usual cost and with higher confidence in brand safety. The business sees a faster cycle to market and higher approval rates—without adding headcount.

---

## Success Metrics

* Time-to-First-Render (TTFR): Median under 8 minutes for at least one variant per job.

* Approved-First-Pass Rate: 70%+ of outputs accepted without external editing.

* Cost per Finished Minute: 30–50% reduction compared to baseline manual workflows.

* Job Success Rate: 98%+ jobs finishing within budget and deadline; <2% manual intervention.

* Variant Throughput: Average 3+ variants per job; 40% jobs use multivariate tests.

### User-Centric Metrics

* DAU/WAU and org activation rate within 14 days of invite.

* NPS/CSAT post-delivery; target ≥45 NPS and ≥4.5/5 CSAT.

* Median iteration cycle time (first review to approved) under 45 minutes.

* QC-assisted fix acceptance rate ≥80%.

### Business Metrics

* Gross margin per minute generated; target ≥55% within 90 days.

* Expansion revenue: 25% of orgs increase monthly budgets by month 2.

* Churn: <3% logo churn quarterly among active orgs.

* Provider cost optimization: ≥15% savings via routing vs. naive allocation.

### Technical Metrics

* P95 provider-render latency within declared SLOs per provider class.

* Uptime: ≥99.9% core orchestration; webhook delivery success ≥99% within 5 minutes.

* Error budgets: <1% failed branches; <0.5% misrouted jobs.

* Storage egress cache hit rate ≥60% for repeated downloads.

### Tracking Plan

* brief.created, assets.uploaded, constraints.set, routing.previewed, job.launched

* branch.dispatched(provider), branch.retry, branch.fallback, branch.completed

* audio.tagged, qc.passed, qc.failed(reason)

* variant.viewed, scene.locked, partial.rerun

* export.requested, export.completed, delivery.webhook.delivered

* budget.threshold.reached, job.paused, job.cancelled

* auth.login, user.invited, api.key.created

* billing.usage.recorded, report.generated

---

## Technical Considerations

### Technical Needs

* Orchestration API: Create jobs, manage branches, expose status/logs; idempotent, resumable uploads.

* Scheduler & Queue: Priority-aware, tenant quotas, backpressure; concurrency controls per provider.

* Provider Adapters: Modular connectors for HeyGen, KlingAI, Veo3, and others with unified request/response schemas.

* Rules & Scoring: Routing engine combining static rules (budget/deadline) and learned performance signals.

* Media Pipeline: Asset graph, scene-level segmentation, stitching, transcode, captions generation, and QC analyzers.

* Audio Stack: Tagging (language, music, SFX), loudness normalization, VO alignment/lip-sync hints, beat detection.

* Front-End: Timeline/progress UI, side-by-side compare, review tools, admin settings; responsive and accessible.

* Observability: Centralized logging, metrics, traces; correlation IDs across all components.

* Security & Auth: RBAC, SSO, scoped API keys, signed webhooks, audit trails.

### Integration Points

* Video/Audio Generation: HeyGen, KlingAI, Veo3, optional Runway/Pika/Stability/ElevenLabs.

* Delivery: DAMs, cloud storage providers, and ad platforms via export profiles.

* Notifications: Email, Slack/Teams webhooks.

* Billing: Usage metering and cost reporting; integration with payment processor if required.

* Governance: Consent and rights metadata capture; policy engines for content filters.

### Data Storage & Privacy

* Data Flow: Assets ingress to secure object storage; job metadata in a transactional store; provider requests via ephemeral URLs; outputs stored with lineage.

* Privacy: Encryption in transit and at rest; tenant isolation; scoped API tokens; PII minimization.

* Compliance: Audit logs and consent tracking; data residency options; GDPR/CCPA alignment; configurable retention and deletion policies.

* IP & Rights: Source attribution for audio/music; contract terms attached to assets; exportable rights report.

### Scalability & Performance

* Load Targets: MVP 100 concurrent renders; scale to 1,000+ with horizontal workers and adaptive concurrency.

* Caching & Warmup: Provider token and session reuse; pre-warmed pools for hot models; CDN for downloads.

* Backpressure: Queue-based throttling; dynamic rerouting on provider saturation or rate limits.

* Multi-Region Readiness: Stateless workers with replicated storage and region-aware routing (future phase).

### Potential Challenges

* Provider Variability: Latency/outages and version drift—mitigate with health checks, pinning, and fallbacks.

* Cost Uncertainty: Variable pricing—mitigate with pre-flight estimates, real-time metering, and budget guards.

* Quality Divergence: Lip-sync and motion artifacts—mitigate with QC analyzers and targeted reruns.

* Compliance & Safety: False positives/negatives—provide explainable flags and guided remediation.

* Large Asset Handling: Long uploads and egress costs—use resumable uploads and smart packaging.

---

## Milestones & Sequencing

A lean, fast-moving plan optimized for a small team and quick feedback.

### Project Estimate

* Large: 4–8 weeks for MVP to production pilot, with iterative releases every 1–2 weeks.

### Team Size & Composition

* Medium Team (3–5 total people)

  * 1 Product Manager/Designer (hybrid)

  * 1 Backend/Orchestration Engineer

  * 1 Full-Stack Engineer (front-end + API)

  * Optional: 1 Integrations Engineer (contract) and 1 QA/Support (part-time during hardening)

### Suggested Phases

* Phase 0: Foundations & Provider Spikes (3–5 days)

  * Key Deliverables: PM/Designer—wireframes of brief and timeline UI; Backend—provider adapter stubs; Full-Stack—skeleton app with auth; Metrics scaffold.

  * Dependencies: Provider API access keys; sample assets; brand kit templates.

* Phase 1: Core Orchestrator + Two Providers (2 weeks)

  * Key Deliverables: Backend—job model, queue, routing rules, health checks; Integrations—HeyGen + KlingAI adapters; Front-End—brief creation, constraints, launch, basic timeline; API—jobs, status, assets.

  * Dependencies: Provider rate limits configured; storage and CDN set up.

* Phase 2: Parallel Variants, Fallbacks, and Reruns (1–1.5 weeks)

  * Key Deliverables: Backend—parallel dispatch, per-branch controls, retries/fallbacks; Front-End—Gantt timeline, branch actions; API—rerun endpoints; Observability—branch-level metrics.

  * Dependencies: Concurrency policies; budget guardrails.

* Phase 3: Audio Tagging, QC, and Delivery (1 week)

  * Key Deliverables: Audio tagging pipeline, loudness normalization; QC checks (duration, black frames, basic speech); Captions generation; Exports to storage/DAM; Webhooks for delivery.

  * Dependencies: Music library integration (if used); captioning component.

* Phase 4: Hardening, Analytics, and Pilot (1 week)

  * Key Deliverables: Cost dashboards, provider performance analytics; RBAC and budget caps; NPS/CSAT capture; doc + runbooks; pilot with 1–2 design partners.

  * Dependencies: Billing/metering provisioning; support workflows.

* Phase 5: Optional Enhancements (ongoing, 1–2 weeks sprints)

  * Key Deliverables: Add Veo3 adapter; localization; advanced QC; side-by-side review and scene locking; additional export presets.

  * Dependencies: New provider contracts; localization datasets.