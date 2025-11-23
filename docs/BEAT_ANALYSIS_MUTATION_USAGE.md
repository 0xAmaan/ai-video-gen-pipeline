# Beat Analysis Mutation Usage Guide

## Overview

Task 19 implemented the public `analyzeBeatsMutation` to trigger beat analysis on audio assets. This mutation provides a clean, user-facing API for initiating beat analysis.

## Implementation Summary

### Files Modified
- `convex/beatAnalysis.ts` - Added public mutation `analyzeBeatsMutation`

### Functions Implemented

#### 1. `analyzeBeatsMutation` (Public Mutation)
**Location:** `convex/beatAnalysis.ts:172-217`

Triggers beat analysis for an audio asset.

**Arguments:**
- `assetId: Id<"audioAssets">` - The ID of the audio asset to analyze

**Validation:**
- Checks if asset exists
- Validates asset has a URL
- Prevents duplicate analysis (checks if status is already "analyzing")

**Behavior:**
1. Validates the asset exists and has a URL
2. Sets `beatAnalysisStatus` to `"analyzing"`
3. Clears any previous errors
4. Schedules `performAnalysis` internal action immediately
5. Logs all steps for debugging

**Error Handling:**
- Throws descriptive errors if asset not found
- Throws error if asset has no URL
- Throws error if analysis already in progress

#### 2. `performAnalysis` (Internal Action)
**Location:** `convex/beatAnalysis.ts:226-327`

Calls Replicate API and processes results (already existed, no changes needed).

#### 3. `saveBeatMarkers` (Internal Mutation)
**Location:** `convex/beatAnalysis.ts:336-369`

Saves beat analysis results to database (already existed, no changes needed).

#### 4. `markAnalysisFailed` (Internal Mutation)
**Location:** `convex/beatAnalysis.ts:377-401`

Marks analysis as failed with error message (already existed, no changes needed).

## Usage Examples

### From React Component

```typescript
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

function AudioAssetCard({ assetId }: { assetId: Id<"audioAssets"> }) {
  const analyzeBets = useMutation(api.beatAnalysis.analyzeBeatsMutation);

  const handleAnalyze = async () => {
    try {
      await analyzeBets({ assetId });
      console.log("Analysis started!");
    } catch (error) {
      console.error("Failed to start analysis:", error);
    }
  };

  return (
    <button onClick={handleAnalyze}>
      Analyze Beats
    </button>
  );
}
```

### From Server Action

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function triggerAnalysis(assetId: string) {
  await client.mutation(api.beatAnalysis.analyzeBeatsMutation, {
    assetId,
  });
}
```

### Testing in Convex Dashboard

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Navigate to your deployment
3. Click "Functions" tab
4. Find `beatAnalysis:analyzeBeatsMutation`
5. Test with:
   ```json
   {
     "assetId": "<your-asset-id>"
   }
   ```

## Status Flow

1. **Initial State:** `beatAnalysisStatus: "not_analyzed"`
2. **User Triggers:** Call `analyzeBeatsMutation({ assetId })`
3. **Mutation Updates:** `beatAnalysisStatus: "analyzing"`
4. **Action Scheduled:** `performAnalysis` runs in background
5. **Success:** `beatAnalysisStatus: "completed"`, `beatMarkers` and `bpm` populated
6. **Failure:** `beatAnalysisStatus: "failed"`, `analysisError` set

## Monitoring Analysis Progress

Poll the asset to check status:

```typescript
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

function AnalysisStatus({ assetId }: { assetId: Id<"audioAssets"> }) {
  const asset = useQuery(api.audioAssets.get, { assetId });

  if (!asset) return <div>Loading...</div>;

  switch (asset.beatAnalysisStatus) {
    case "not_analyzed":
      return <div>Not analyzed</div>;
    case "analyzing":
      return <div>Analyzing... (30-60 seconds)</div>;
    case "completed":
      return (
        <div>
          Complete! {asset.beatMarkers?.length} beats detected
          {asset.bpm && ` at ${asset.bpm} BPM`}
        </div>
      );
    case "failed":
      return <div>Failed: {asset.analysisError}</div>;
    default:
      return <div>Unknown status</div>;
  }
}
```

## Error Handling

The mutation includes comprehensive error handling:

### Asset Not Found
```
Error: Audio asset <id> not found
```

### Missing URL
```
Error: Audio asset <id> has no URL for analysis
```

### Duplicate Analysis
```
Error: Beat analysis is already in progress for this asset
```

### API Token Not Configured
Analysis will fail with:
```
analysisError: "REPLICATE_API_TOKEN not configured in environment"
beatAnalysisStatus: "failed"
```

### No Beat Data
Analysis will fail with:
```
analysisError: "No beat data found in analysis output"
beatAnalysisStatus: "failed"
```

## Next Steps

Task 22 will implement the UI component to trigger this mutation from the asset context menu.

## Testing

The mutation has been deployed and is ready for testing. You can:

1. **Manual Test:** Use the Convex dashboard (see "Testing in Convex Dashboard" above)
2. **Automated Test:** Run `npm run test:beat-analysis` (when implemented in Task 22)
3. **Integration Test:** Test from the UI context menu (Task 23)

## Related Tasks

- Task 17: ✅ Database schema (completed)
- Task 18: ✅ Replicate API integration (completed)
- **Task 19: ✅ Backend mutations (this task - completed)**
- Task 20: ✅ Audio extraction utility (completed)
- Task 21: ⏳ Client-side fallback (pending)
- Task 22: ⏳ UI trigger component (pending)
- Task 23: ⏳ Context menu integration (pending)
