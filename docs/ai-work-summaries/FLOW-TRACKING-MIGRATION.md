# Flow Tracking - Automatic Architecture

## Problem
Manual flow tracking was error-prone - forgetting to add `_flowEvents` to API responses or `importEvents()` in pages meant events disappeared.

## Solution
**Automatic flow tracking** via wrapper functions that handle everything.

---

## For API Routes

### Old Way (Manual - Error Prone ❌)
```typescript
import { NextResponse } from "next/server";
import { getFlowTracker } from "@/lib/flow-tracker";

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();

  flowTracker.trackAPICall("POST", "/api/example", { ... });

  // ... your logic ...

  // ❌ EASY TO FORGET THIS LINE
  return NextResponse.json({
    success: true,
    data: result,
    _flowEvents: flowTracker.getEvents(), // ❌ Manual!
  });
}
```

### New Way (Automatic - Foolproof ✅)
```typescript
import { apiResponse, apiError } from "@/lib/api-response";
import { getFlowTracker } from "@/lib/flow-tracker";

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();

  flowTracker.trackAPICall("POST", "/api/example", { ... });

  // ... your logic ...

  // ✅ AUTOMATICALLY INCLUDES _flowEvents
  return apiResponse({
    success: true,
    data: result,
  });

  // For errors:
  // return apiError("Something went wrong", 500);
}
```

**Benefits:**
- ✅ `_flowEvents` automatically appended to every response
- ✅ Impossible to forget
- ✅ Works for all future API routes
- ✅ Consistent error handling

---

## For Client Pages

### Old Way (Manual - Error Prone ❌)
```typescript
import { getDemoMode } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";

const response = await fetch("/api/example", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-demo-mode": getDemoMode(), // ❌ Manual header
  },
  body: JSON.stringify({ ... }),
});

const data = await response.json();

// ❌ EASY TO FORGET THIS
if (data._flowEvents) {
  const tracker = getFlowTracker();
  tracker.importEvents(data._flowEvents);
}
```

### New Way (Automatic - Foolproof ✅)
```typescript
import { apiFetch, apiFetchJSON } from "@/lib/api-fetch";

// Option 1: Simple JSON call
const data = await apiFetchJSON("/api/example", {
  method: "POST",
  body: JSON.stringify({ ... }),
});
// ✅ AUTOMATICALLY imports flow events
// ✅ AUTOMATICALLY sends demo mode header

// Option 2: Full control over response
const response = await apiFetch("/api/example", {
  method: "POST",
  body: JSON.stringify({ ... }),
});
const data = await response.json();
// ✅ Still automatically imports flow events
```

**Benefits:**
- ✅ Flow events automatically imported
- ✅ Demo mode header automatically sent
- ✅ Impossible to forget
- ✅ Works for all current and future API calls

---

## Migration Checklist

### Phase 1: Update API Routes (Optional but Recommended)

For each API route in `app/api/`:

1. Add import:
   ```typescript
   import { apiResponse, apiError } from "@/lib/api-response";
   ```

2. Replace `NextResponse.json()` with `apiResponse()`:
   ```typescript
   // Before:
   return NextResponse.json({ success: true, ... });

   // After:
   return apiResponse({ success: true, ... });
   ```

3. Remove manual `_flowEvents` appending (if present)

**Example files to update:**
- ✅ `app/api/generate-questions/route.ts` (already has `_flowEvents`, just swap to `apiResponse`)
- ✅ `app/api/generate-storyboard/route.ts`
- ✅ `app/api/generate-character-variations/route.ts`
- ⚠️ All other `/api/**/route.ts` files

### Phase 2: Update Client Pages (Required for Flow Tracking)

For each page that calls APIs:

1. Add import:
   ```typescript
   import { apiFetch, apiFetchJSON } from "@/lib/api-fetch";
   ```

2. Replace `fetch()` with `apiFetch()` or `apiFetchJSON()`:
   ```typescript
   // Before:
   const response = await fetch("/api/example", { ... });
   const data = await response.json();

   // After (simple):
   const data = await apiFetchJSON("/api/example", { ... });

   // Or (full control):
   const response = await apiFetch("/api/example", { ... });
   const data = await response.json();
   ```

3. Remove manual `getDemoMode()` and `importEvents()` calls

**Example files to update:**
- ✅ `app/[projectId]/prompt/page.tsx`
- ⚠️ `app/[projectId]/storyboard/page.tsx`
- ⚠️ `app/[projectId]/character-select/page.tsx`
- ⚠️ `app/[projectId]/video/page.tsx`
- ⚠️ Any other pages calling `/api/*`

---

## Opt-Out Options

If you need to disable automatic behavior for specific cases:

### Skip flow tracking in API response:
```typescript
return apiResponse({ success: true }, { skipFlowEvents: true });
```

### Skip flow import on client:
```typescript
const data = await apiFetchJSON("/api/example", {
  skipFlowTracking: true
});
```

---

## Testing

After migration, test that:

1. ✅ Flow events appear in Flow Log during API calls
2. ✅ Demo mode toggle affects API behavior
3. ✅ No console errors about missing `_flowEvents`
4. ✅ Trash button clears events properly

---

## Future Benefits

With this architecture:
- ✅ Add new API route → Flow tracking works automatically
- ✅ Call any API from any page → Events appear automatically
- ✅ Zero maintenance overhead
- ✅ Consistent behavior across entire app
- ✅ Easy to add global API middleware (rate limiting, auth, etc.)
