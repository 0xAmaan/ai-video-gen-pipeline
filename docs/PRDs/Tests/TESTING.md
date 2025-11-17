# Testing Guide

This project uses Vitest and React Testing Library for testing.

## Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with UI
bun test:ui

# Run tests with coverage
bun test:coverage
```

## Test Structure

### API Route Tests (`app/api/generate-video-clip/route.test.ts`)

Tests for the video clip generation API endpoint covering:

- **Request Validation**: Ensures proper validation of clip payloads
  - Required fields (imageUrl, prompt)
  - Default values (duration: 5, resolution: '720p')
  - Multiple payload formats (single object, array, wrapped object)

- **Concurrency Control**: Tests the concurrent video generation logic
  - Default concurrency of 3
  - Respects maxConcurrency parameter
  - Limits concurrency to number of clips

- **Video Generation**: Tests the actual video generation flow
  - Successful generation
  - Prompt enhancement
  - Error handling
  - Maintaining clip order

- **Response Format**: Validates response structure
  - Success/failure status
  - Metadata (total, successful, failed, concurrency)
  - Video URL extraction

- **Output Format Handling**: Tests different Replicate API response formats
  - String URLs
  - Array of URLs
  - Objects with url property
  - Objects with url() function

### Component Tests (`components/StoryboardGeneratingPhase.test.tsx`)

Tests for the storyboard generation UI component covering:

- **Rendering**: Basic rendering and scene display
- **Stage-specific Behavior**: Different messages for each generation stage
- **Progress Tracking**: Progress calculation and time estimates
- **Scene Status Indicators**: Visual states for completed/generating/pending scenes
- **Cost Estimation**: Calculates estimated cost based on scene count
- **Edge Cases**: Handles zero scenes, missing data, long descriptions
- **Accessibility**: Alt text, headings, keyboard navigation

### Integration Tests (`app/create/page.test.tsx`)

Tests for the main create page workflow covering:

- **Phase Navigation**: Moving through different phases of video creation
- **Input Phase Completion**: Handling form submission and API calls
- **Video Generation Phase**: Creating predictions and polling status
- **Editor Phase**: Transitioning to editor and export functionality
- **State Management**: Maintaining project state across phases
- **Error Handling**: Graceful error handling throughout the flow

## Test Coverage Areas

1. **API Endpoints**: Comprehensive testing of video generation API
2. **React Components**: UI components with user interactions
3. **Integration Flows**: End-to-end user workflows
4. **Error Scenarios**: Edge cases and error handling
5. **Concurrency**: Parallel video generation logic

## Mocking Strategy

- **Replicate API**: Mocked to avoid external API calls
- **Convex**: Mocked mutations and queries
- **Next.js Components**: Mocked child components for isolation
- **Fetch API**: Mocked for API endpoint testing

## Known Limitations

- Some tests may need adjustment based on actual Replicate API response format
- Mock implementations simulate but don't fully replicate production behavior
- Integration tests use simplified component mocks

## Adding New Tests

1. Create test file next to the file being tested with `.test.ts` or `.test.tsx` extension
2. Import necessary testing utilities and mocks
3. Write descriptive test cases using `describe` and `it` blocks
4. Use `expect` assertions to validate behavior
5. Clean up mocks in `beforeEach` hooks

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run tests
  run: bun test --run

- name: Generate coverage
  run: bun test:coverage
```
