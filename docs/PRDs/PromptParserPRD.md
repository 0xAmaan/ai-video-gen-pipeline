# Prompt Parser - Product Requirements Document

**Project**: Prompt Parser - Intelligent prompt interpretation and enrichment system for AI video ad generation  
**Goal**: Transform user-submitted video ad prompts into actionable, AI-ready metadata through intelligent parsing and interactive refinement

**Note**: This system serves as the entry point for all video generation workflows, ensuring high-quality inputs that lead to better outputs

---

## Core Architecture

**Intelligent Parsing Pipeline:**

- Natural language processing to extract key elements from user prompts
- Multi-stage enrichment process that adds metadata, context, and structure
- Interactive clarification system that proactively identifies ambiguities
- Unified schema output that feeds seamlessly into downstream generation systems
- Future: Advanced brand voice analysis and automatic style guide integration

**Data Flow Structure:**

- Input: Raw text prompts, brand guidelines, reference materials
- Processing: Parse → Analyze → Clarify → Enrich → Validate
- Output: Structured JSON with comprehensive generation metadata

---

## User Stories

### Primary User: Creative Teams and Marketers

- As a marketer, I want to **submit a brief description of my video ad concept** so that the system understands my creative intent
- As a creative director, I want to **receive intelligent questions about ambiguous aspects** so that my vision is accurately captured
- As a brand manager, I want to **have my brand guidelines automatically applied** so that all outputs remain on-brand
- As a content creator, I want to **see extracted keywords and themes** so that I can verify the system's understanding
- As a marketing team lead, I want to **save and reuse prompt templates** so that we maintain consistency across campaigns

### Secondary User: Agency Teams and Production Houses

- As an agency producer, I want to **batch process multiple prompt variations** so that we can explore different creative directions
- As a production coordinator, I want to **track prompt history and iterations** so that we can understand creative evolution

---

## Key Features

### 1. Authentication System

**Must Have:**

- User authentication via Clerk
- Team workspace management
- Role-based access control for prompt templates
- Persistent user sessions
- Brand profile association per user/team

**Display Name Logic:**

- User email prefix as default
- Custom display names in team settings
- Team name prefix for collaborative prompts

**Success Criteria:**

- Users maintain secure access to their prompt history
- Team members can share and collaborate on prompt templates
- Brand guidelines remain associated with appropriate users

### 2. Natural Language Processing Engine

**Must Have:**

- Extract product/service mentions with 95% accuracy
- Identify target audience demographics and psychographics
- Detect emotional tone and desired mood
- Parse duration requirements and format specifications
- Recognize brand elements and style preferences
- Extract call-to-action statements

**Entity Recognition:**

- Product names and categories
- Geographic locations and markets
- Age ranges and demographic segments
- Industry verticals and use cases
- Competitor mentions for differentiation

**Success Criteria:**

- Accurately identifies all major prompt elements
- Processes prompts in under 2 seconds
- Handles multiple languages (English priority)
- Maintains context across compound sentences

### 3. Interactive Clarification System

**Must Have:**

- Dynamic question generation based on prompt gaps
- Priority-ordered clarification requests
- Optional vs required field distinction
- Progressive disclosure of advanced options
- Context-aware suggestion system

**Clarification Types:**

- Target platform selection (Instagram Stories, YouTube Shorts, etc.)
- Visual style preferences (realistic, animated, mixed)
- Tone specification (professional, casual, humorous)
- Pacing preferences (fast-cut, smooth, dramatic)
- Music style and audio preferences

**Success Criteria:**

- Asks only relevant questions based on prompt content
- Completes clarification in 3-5 questions maximum
- Provides smart defaults for skipped questions
- Maintains conversation context throughout session

### 4. Metadata Enrichment Layer

**Must Have:**

- Automatic keyword expansion using semantic analysis
- Industry-specific terminology injection
- Trending hashtag and topic integration
- Competitive landscape awareness
- Brand voice calibration

**Enrichment Categories:**

- Visual descriptors (lighting, color palette, composition)
- Audio attributes (tempo, genre, mood)
- Motion characteristics (transitions, effects, pacing)
- Text overlays (fonts, positions, animations)
- Emotional journey mapping

**Success Criteria:**

- Adds 10-20 relevant metadata tags per prompt
- Maintains semantic accuracy above 90%
- Completes enrichment in under 1 second
- Preserves user intent while adding detail

### 5. Brand Consistency Engine

**Must Have:**

- Brand guideline document parsing (PDF, DOCX)
- Color palette extraction and enforcement
- Typography rules application
- Logo placement specifications
- Messaging tone validation

**Brand Profile Components:**

- Primary and secondary color schemes
- Approved font families and hierarchies
- Logo variations and usage rules
- Approved terminology and phrases
- Prohibited elements and competitors

**Success Criteria:**

- Automatically applies brand rules to all prompts
- Flags potential brand violations before generation
- Maintains brand profile versioning
- Supports multiple brands per organization

### 6. Template Management System

**Must Have:**

- Save successful prompts as reusable templates
- Categorize templates by campaign, product, or theme
- Variable placeholders for dynamic content
- Version control for template iterations
- Sharing mechanisms within teams

**Template Features:**

- Rich metadata preservation
- Performance metrics tracking
- A/B testing variant creation
- Approval workflow integration
- Template marketplace (future)

**Success Criteria:**

- Templates load instantly
- Variables populate correctly
- Sharing maintains all metadata
- Version history is accessible

### 7. Output Schema Generation

**Must Have:**

- Standardized JSON output format
- Comprehensive metadata inclusion
- Downstream system compatibility
- Validation against generation requirements
- Error handling for incomplete data

**Schema Structure:**

- Core prompt elements
- Enriched metadata tags
- Brand specifications
- Platform requirements
- Generation parameters

**Success Criteria:**

- 100% schema compliance for all outputs
- Validates against Zod schemas
- Includes all required generation fields
- Maintains backward compatibility

### 8. Analytics and Insights

**Must Have:**

- Prompt complexity scoring
- Common element tracking
- Success rate monitoring
- User behavior analytics
- Performance optimization data

**Success Criteria:**

- Real-time analytics dashboard
- Actionable insights generation
- Performance trend identification
- User journey optimization

### 9. Integration Layer

**Must Have:**

- Seamless connection to Generation Engine
- Content Planner compatibility
- Brand asset library access
- External API support
- Webhook notifications

**Success Criteria:**

- Zero-friction handoff to next systems
- Maintains data integrity across systems
- Supports async and sync operations
- Handles high throughput efficiently

---

## Data Model

### Convex Collection: `prompts`

**Document Structure:**

```json
{
  "promptId": "prm_abc123xyz",
  "userId": "usr_123456",
  "teamId": "team_789",
  "originalText": "Create a 30-second Instagram ad for our new organic smoothie line targeting health-conscious millennials",
  "parsedElements": {
    "duration": 30,
    "platform": "instagram",
    "product": "organic smoothie line",
    "targetAudience": "health-conscious millennials",
    "format": "video_ad"
  },
  "clarifications": {
    "visualStyle": "bright_modern",
    "musicPreference": "upbeat_electronic",
    "callToAction": "shop_now",
    "aspectRatio": "9:16"
  },
  "enrichedMetadata": {
    "keywords": ["organic", "healthy", "smoothie", "wellness", "natural"],
    "colorSuggestions": ["green", "white", "earth_tones"],
    "emotionalTone": "energetic_positive",
    "pacingScore": 8,
    "visualElements": ["fresh_fruits", "active_lifestyle", "morning_routine"]
  },
  "brandProfile": {
    "brandId": "brd_456",
    "primaryColors": ["#2ECC71", "#FFFFFF"],
    "fontFamily": "Helvetica Neue",
    "logoPosition": "bottom_right",
    "toneOfVoice": "friendly_expert"
  },
  "outputSchema": {
    "version": "1.0",
    "generationReady": true,
    "validationStatus": "passed",
    "warnings": []
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "status": "ready_for_generation"
}
```

### Convex Collection: `promptTemplates`

```json
{
  "templateId": "tpl_xyz789",
  "teamId": "team_789",
  "name": "Product Launch - Social",
  "category": "product_launch",
  "basePrompt": "Create a {{duration}}-second {{platform}} ad for {{product}} targeting {{audience}}",
  "defaultValues": {
    "duration": 30,
    "platform": "instagram",
    "visualStyle": "modern_clean"
  },
  "requiredVariables": ["product", "audience"],
  "optionalVariables": ["location", "season", "promotion"],
  "performanceMetrics": {
    "usageCount": 47,
    "averageEngagement": 0.82,
    "conversionRate": 0.045
  },
  "createdBy": "usr_123456",
  "createdAt": "timestamp",
  "lastModified": "timestamp",
  "version": 3
}
```

### Convex Collection: `brandProfiles`

```json
{
  "brandId": "brd_456",
  "teamId": "team_789",
  "brandName": "GreenLife Smoothies",
  "guidelines": {
    "colors": {
      "primary": ["#2ECC71", "#27AE60"],
      "secondary": ["#ECF0F1", "#BDC3C7"],
      "accent": ["#F39C12"]
    },
    "typography": {
      "heading": "Montserrat",
      "body": "Open Sans",
      "sizes": {
        "h1": "32px",
        "h2": "24px",
        "body": "16px"
      }
    },
    "imagery": {
      "style": "bright_natural_photography",
      "filters": "high_contrast_warm",
      "prohibitedElements": ["processed_foods", "artificial_ingredients"]
    },
    "messaging": {
      "tone": "friendly_knowledgeable",
      "keywords": ["organic", "natural", "wellness", "energy"],
      "avoidWords": ["cheap", "discount", "artificial"]
    }
  },
  "assets": {
    "logos": ["logo_primary_url", "logo_white_url"],
    "fontFiles": ["font_url_1", "font_url_2"]
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

## Recommended Tech Stack

**Frontend:** Next.js 16.0.3 with App Router + React 19.2.0 + TypeScript 5  
**UI Components:** Radix UI + shadcn/ui + Tailwind CSS v4  
**Backend:** Convex for real-time database and backend functions  
**Authentication:** Clerk for user management and team workspaces  
**AI Integration:** Vercel AI SDK with OpenAI for NLP processing  
**Validation:** Zod for schema validation  
**Runtime:** Bun for package management and runtime  

**Rationale:** This stack provides real-time capabilities through Convex, robust authentication via Clerk, and powerful AI integration through Vercel AI SDK, all essential for intelligent prompt processing and team collaboration.

---

## Out of Scope

### Features NOT Included:

- Video preview generation at this stage
- Direct video editing capabilities
- Multi-language prompt translation
- Voice-to-text prompt input
- Historical performance prediction
- Automated A/B test generation
- Direct social media posting
- Budget estimation tools

### Technical Items NOT Included:

- Custom NLP model training
- Offline prompt processing
- Blockchain verification
- Federated learning systems
- Custom authentication system
- Direct cloud storage integration
- Native mobile applications
- Browser extensions

---

## Known Limitations & Trade-offs

1. **Language Support**: Initially English-only with other languages planned for future phases
2. **Prompt Length**: Maximum 1000 characters to maintain processing efficiency
3. **Brand Profiles**: Limited to 10 active brands per organization initially
4. **Template Sharing**: Within organization only, no public marketplace yet
5. **Processing Time**: 2-5 second total processing time for complex prompts
6. **Clarification Rounds**: Maximum 2 rounds of clarification to prevent user fatigue
7. **File Uploads**: Brand guidelines limited to 10MB PDF/DOCX files
8. **API Rate Limits**: 100 prompts per minute per organization

---

## Success Metrics

1. **95% prompt parsing accuracy** for standard ad descriptions
2. **Under 3 seconds total processing time** for 90% of prompts
3. **80% of users complete clarification** when prompted
4. **60% prompt template reuse rate** after first month
5. **90% schema validation success** on first attempt
6. **Zero data loss** during enrichment pipeline

---

## Testing Checklist

### Core Functionality:

- [ ] User can authenticate and access workspace
- [ ] Prompt submission processes successfully
- [ ] NLP extraction identifies key elements
- [ ] System generates relevant clarification questions

### Parsing Operations:

- [ ] Product names extracted accurately
- [ ] Target audience identified correctly
- [ ] Duration and format parsed properly
- [ ] Emotional tone detected appropriately
- [ ] Platform requirements recognized

### Enrichment Features:

- [ ] Metadata tags added appropriately
- [ ] Brand guidelines applied when available
- [ ] Keywords expanded semantically
- [ ] Color suggestions match brand profile
- [ ] Validation passes for complete prompts

### Integration Points:

- [ ] Output schema generates correctly
- [ ] Data flows to Generation Engine
- [ ] Templates save and load properly
- [ ] Team sharing works as expected
- [ ] Analytics track all events

### Performance:

- [ ] Processing completes under 5 seconds
- [ ] System handles concurrent users
- [ ] Database queries remain responsive
- [ ] API endpoints respond quickly
- [ ] UI remains responsive during processing

---

## Risk Mitigation

**Biggest Risk:** Inaccurate prompt parsing leading to poor video generation  
**Mitigation:** Implement confidence scoring with human-in-the-loop validation for low-confidence extractions; maintain feedback loop for continuous improvement

**Second Risk:** Brand guideline violations in generated content  
**Mitigation:** Strict validation layer with brand compliance scoring; require explicit override for guideline deviations

**Third Risk:** User abandonment during clarification process  
**Mitigation:** Smart defaults for all optional fields; progressive disclosure to minimize cognitive load

**Fourth Risk:** Performance degradation with complex prompts  
**Mitigation:** Implement caching strategies and optimize NLP processing; use background jobs for non-critical enrichment