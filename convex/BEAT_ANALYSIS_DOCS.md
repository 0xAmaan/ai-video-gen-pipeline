# Beat Analysis - Replicate Integration Documentation

## Overview

This module integrates with Replicate's `cwalo/all-in-one-music-structure-analysis` model to perform beat detection and BPM analysis on audio files.

## Implementation Details

### File: `convex/beatAnalysis.ts`

**Exports:**
- `performAnalysis` - Internal action to analyze audio files
- `saveBeatMarkers` - Internal mutation to save analysis results
- `markAnalysisFailed` - Internal mutation to record failures

### Replicate Model

**Model ID:** `cwalo/all-in-one-music-structure-analysis:6deeba047db17da69e9826c0285cd137cd2a81af05eb44ff496b7acd69b3a383`

**Input Parameters:**
```javascript
{
  music_input: <audio_url>,    // Publicly accessible audio file URL
  model: "harmonix-all",        // Analysis model to use
  visualize: false,             // Don't generate visualization
  sonify: false                 // Don't generate sonification
}
```

**Cost:** ~$0.15 per 50-second analysis (L40S hardware)

**Processing Time:** 30-60 seconds typical

## Critical: Replicate Response Format

⚠️ **Important Discovery**: Replicate returns file outputs as `ReadableStream` objects, not direct JSON.

### Response Handling

The Replicate SDK returns responses in one of three formats:

#### Format 1: ReadableStream (Most Common) ✅
```javascript
{
  '0': ReadableStream {
    _reader: ...,
    _state: ...,
    _readableStreamController: ...
  }
}
```

**Handling:**
```javascript
if (firstElement && typeof firstElement === 'object' && '_reader' in firstElement) {
  const blob = await new Response(firstElement).blob();
  const text = await blob.text();
  const data = JSON.parse(text);
}
```

#### Format 2: URL String (Fallback)
```javascript
{
  '0': "https://replicate.delivery/pbxt/abc123/output.json"
}
```

**Handling:**
```javascript
if (typeof firstElement === 'string' && firstElement.startsWith('http')) {
  const response = await fetch(firstElement);
  const data = await response.json();
}
```

#### Format 3: Direct Object (Edge Case)
```javascript
{
  beats: [14.27, 15.17, ...],
  downbeats: [16.05, 19.61, ...],
  bpm: 136
}
```

**Handling:**
```javascript
if (typeof firstElement === 'object' && !('_reader' in firstElement)) {
  const data = firstElement;
}
```

### Parsed Data Structure

After converting stream/URL to JSON:

```javascript
{
  beats: number[],         // Array of beat timestamps in seconds
  downbeats: number[],     // Array of downbeat timestamps
  bpm: number | string,    // BPM value (sometimes string)
  // ... other analysis data
}
```

## Data Transformation

### Input → Output Pipeline

1. **Replicate API Call** → ReadableStream
2. **Stream → Blob** → Text
3. **Text → JSON** → Raw analysis data
4. **Parse & Transform** → BeatMarker array

### BeatMarker Schema

```typescript
interface BeatMarker {
  time: number;           // Timestamp in seconds
  strength?: number;      // 1.0 for downbeats, 0.8 for regular beats
  isDownbeat?: boolean;   // true if this is a downbeat
}
```

### Deduplication & Sorting

The parser:
1. Extracts separate `beats` and `downbeats` arrays
2. Combines them using `Set` (automatic deduplication)
3. Sorts by timestamp ascending
4. Adds `isDownbeat` and `strength` properties

## Database Schema

### audioAssets Table Fields

```javascript
{
  beatMarkers: BeatMarker[],           // Array of beat timestamps
  bpm: number,                         // Beats per minute
  beatAnalysisStatus: enum,            // "not_analyzed" | "analyzing" | "completed" | "failed"
  analysisMethod: string,              // "replicate" | "client" | etc.
  analysisError: string | undefined,   // Error message if failed
  updatedAt: number                    // Timestamp of last update
}
```

## Error Handling

### Failure Scenarios

1. **Missing API Token**
   - Error: "REPLICATE_API_TOKEN not configured"
   - Status: `failed`

2. **API Request Failure**
   - Error: Replicate API error message
   - Status: `failed`

3. **Invalid Response**
   - Error: "No beat data found in analysis output"
   - Status: `failed`

4. **Stream Reading Failure**
   - Error: Stream conversion error
   - Status: `failed`

### Error Recovery

All errors are caught and:
1. Logged to Convex logs with `[performAnalysis]` prefix
2. Saved to database via `markAnalysisFailed` mutation
3. Status set to `failed` with error message

## Testing

### Manual Testing

See `scripts/test-beat-analysis.js` for manual testing guide.

### Automated Testing Example

See `scripts/test-beat-analysis-example.js` for automated test implementation.

### Test Audio File

**URL:** `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3`

**Expected Results:**
- BPM: ~136
- Beat Count: ~700-800
- Analysis Time: 30-60 seconds
- First beat: ~14.27s

## Production Considerations

### Rate Limits

Replicate has API rate limits. Consider:
- Queueing analysis requests
- Retry logic with exponential backoff
- Status tracking (`analyzing` state)

### Timeouts

Analysis can take 30-60 seconds:
- No timeout currently configured
- Consider 5-minute timeout for very long audio
- Monitor for stuck analyses

### Costs

- ~$0.15 per 50-second audio file
- Monitor usage in Replicate dashboard
- Consider budget limits per project

### Environment Variables

**Required:**
```
REPLICATE_API_TOKEN=<your_token>
```

Set in Convex Dashboard → Settings → Environment Variables

## Future Improvements

1. **Client-side fallback** - Task 21 (if Replicate fails)
2. **Progress updates** - Real-time status updates
3. **Retry logic** - Automatic retry on transient failures
4. **Caching** - Cache results for duplicate analyses
5. **Batch processing** - Analyze multiple files efficiently

## Related Tasks

- **Task 17:** Schema definition
- **Task 18:** Replicate integration (this file)
- **Task 19:** Mutation handlers
- **Task 21:** Client-side fallback
- **Task 23:** UI integration
- **Task 26:** Visualization

## Debugging

### Check Logs

Convex Dashboard → Logs tab

Search for:
- `[performAnalysis]` - Main action logs
- `[parseReplicateOutput]` - Parsing logs
- `[saveBeatMarkers]` - Database save logs
- `[markAnalysisFailed]` - Error logs

### Common Issues

1. **"No beat data found"**
   - Check: Output format changed?
   - Solution: Review logs for data keys

2. **"Converting circular structure to JSON"**
   - Check: Trying to stringify ReadableStream?
   - Solution: Already fixed in current implementation

3. **"Request to Replicate failed with 422"**
   - Check: Model version ID correct?
   - Solution: Verify full SHA256 hash

## Version History

- **v1.0** - Initial implementation with stream handling
- **Test Date:** 2025-11-22
- **Status:** Production Ready ✅
