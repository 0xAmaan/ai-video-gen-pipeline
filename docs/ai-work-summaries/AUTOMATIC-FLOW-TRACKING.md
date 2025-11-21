# ✅ Automatic Flow Tracking - Zero Maintenance Required

## Problem Solved
Previously, flow tracking required manual work in every API route and every client page:
- ❌ Easy to forget `_flowEvents: flowTracker.getEvents()` in API responses
- ❌ Easy to forget `tracker.importEvents(data._flowEvents)` in client pages
- ❌ Easy to forget `x-demo-mode` headers
- ❌ Every new API/page needed manual updates
- ❌ Architecture was fragile and annoying

## New Solution
**Completely automatic flow tracking via wrapper functions.**

---

## 🚀 For API Routes - Use `apiResponse()`

### Before (Manual ❌):
```typescript
import { NextResponse } from "next/server";
import { getFlowTracker } from "@/lib/flow-tracker";

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();

  flowTracker.trackAPICall("POST", "/api/example", { ... });

  // ...your logic...

  // ❌ EASY TO FORGET
  return NextResponse.json({
    success: true,
    data: result,
    _flowEvents: flowTracker.getEvents(), // Manual!
  });
}
```

### After (Automatic ✅):
```typescript
import { apiResponse, apiError } from "@/lib/api-response";
import { getFlowTracker } from "@/lib/flow-tracker";

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();

  flowTracker.trackAPICall("POST", "/api/example", { ... });

  // ...your logic...

  // ✅ AUTOMATICALLY includes _flowEvents
  return apiResponse({
    success: true,
    data: result,
  });

  // For errors:
  // return apiError("Something went wrong", 500, optionalDetails);
}
```

**What `apiResponse()` does:**
1. ✅ Automatically appends `_flowEvents: flowTracker.getEvents()`
2. ✅ Returns proper NextResponse.json()
3. ✅ Impossible to forget

---

## 🚀 For Client Pages - Use `apiFetch()`

### Before (Manual ❌):
```typescript
import { getDemoMode } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";

const demoMode = getDemoMode();

const response = await fetch("/api/example", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-demo-mode": demoMode, // ❌ Manual
  },
  body: JSON.stringify({ ... }),
});

const data = await response.json();

// ❌ EASY TO FORGET
if (data._flowEvents) {
  const tracker = getFlowTracker();
  tracker.importEvents(data._flowEvents);
}
```

### After (Automatic ✅):
```typescript
import { apiFetchJSON } from "@/lib/api-fetch";

// ✅ AUTOMATICALLY handles everything
const data = await apiFetchJSON("/api/example", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ... }),
});
```

**What `apiFetchJSON()` does:**
1. ✅ Automatically sends `x-demo-mode` header from localStorage
2. ✅ Automatically imports `_flowEvents` from response
3. ✅ Throws error if response not OK
4. ✅ Returns parsed JSON data

**Alternative - Full Control:**
```typescript
import { apiFetch } from "@/lib/api-fetch";

const response = await apiFetch("/api/example", { ... });
const data = await response.json();
// ✅ Still auto-imports flow events
```

---

## 📊 Example - Complete Before/After

### API Route: `app/api/generate-example/route.ts`

**Before - 50 lines, error-prone:**
```typescript
import { NextResponse } from "next/server";
import { getFlowTracker } from "@/lib/flow-tracker";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  const startTime = Date.now();

  try {
    const { prompt } = await req.json();
    const demoMode = getDemoModeFromHeaders(req.headers);

    flowTracker.trackAPICall("POST", "/api/generate-example", { prompt, demoMode });

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt required" },
        { status: 400 },
      );
    }

    // ...business logic...
    const result = await generateSomething(prompt);

    flowTracker.trackTiming("Generation", Date.now() - startTime, startTime);

    // ❌ Must remember to add _flowEvents
    return NextResponse.json({
      success: true,
      result,
      _flowEvents: flowTracker.getEvents(),
    });

  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 },
    );
  }
}
```

**After - 30 lines, foolproof:**
```typescript
import { apiResponse, apiError } from "@/lib/api-response";
import { getFlowTracker } from "@/lib/flow-tracker";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();
  const startTime = Date.now();

  try {
    const { prompt } = await req.json();
    const demoMode = getDemoModeFromHeaders(req.headers);

    flowTracker.trackAPICall("POST", "/api/generate-example", { prompt, demoMode });

    if (!prompt) {
      return apiError("Prompt required", 400); // ✅ Auto-includes _flowEvents
    }

    // ...business logic...
    const result = await generateSomething(prompt);

    flowTracker.trackTiming("Generation", Date.now() - startTime, startTime);

    return apiResponse({ // ✅ Auto-includes _flowEvents
      success: true,
      result,
    });

  } catch (error) {
    console.error("Error:", error);
    return apiError( // ✅ Auto-includes _flowEvents
      "Failed to generate",
      500,
      error instanceof Error ? error.message : "Unknown",
    );
  }
}
```

### Client Page: `app/[projectId]/example/page.tsx`

**Before - 40 lines:**
```typescript
import { getDemoMode } from "@/lib/demo-mode";
import { getFlowTracker } from "@/lib/flow-tracker";

const handleGenerate = async () => {
  try {
    const demoMode = getDemoMode();
    console.log("Demo mode:", demoMode);
    console.log("Sending header:", demoMode);

    const response = await fetch("/api/generate-example", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-demo-mode": demoMode,
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error("API failed");
    }

    const data = await response.json();
    console.log("Response:", data);
    console.log("Flow events:", data._flowEvents?.length);

    if (data._flowEvents) {
      console.log("Importing flow events");
      const tracker = getFlowTracker();
      tracker.importEvents(data._flowEvents);
    } else {
      console.log("No flow events");
    }

    setResult(data.result);
  } catch (error) {
    console.error("Error:", error);
    setError("Failed");
  }
};
```

**After - 15 lines:**
```typescript
import { apiFetchJSON } from "@/lib/api-fetch";

const handleGenerate = async () => {
  try {
    const data = await apiFetchJSON("/api/generate-example", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    setResult(data.result);
  } catch (error) {
    console.error("Error:", error);
    setError("Failed");
  }
};
```

---

## 🎯 Migration Strategy

### Priority 1: Update Client Pages (Required)
All pages calling APIs need to use `apiFetch` or `apiFetchJSON`:

```bash
# Find all pages with fetch calls
grep -r "await fetch\(" app/\[projectId\]/
```

For each file:
1. Replace `import { getDemoMode }` with `import { apiFetchJSON }`
2. Replace `import { getFlowTracker }` - delete if only used for importEvents
3. Replace `fetch()` → `apiFetchJSON()`
4. Remove manual `getDemoMode()`, header setting, and `importEvents()` calls

### Priority 2: Update API Routes (Recommended)
All API routes should use `apiResponse()` and `apiError()`:

```bash
# Find all API routes
find app/api -name "route.ts"
```

For each file:
1. Add `import { apiResponse, apiError } from "@/lib/api-response"`
2. Replace `NextResponse.json({ ..., _flowEvents: ... })` → `apiResponse({ ... })`
3. Replace error returns → `apiError(...)`

---

## 🔧 Opt-Out (If Needed)

### Skip flow events in specific API response:
```typescript
return apiResponse({ data }, { skipFlowEvents: true });
```

### Skip flow import on specific client call:
```typescript
const data = await apiFetchJSON("/api/example", {
  skipFlowTracking: true,
});
```

---

## ✅ Benefits

1. **Zero maintenance** - Add new API routes without thinking about flow tracking
2. **Impossible to forget** - Automatically handled in wrapper functions
3. **Consistent** - All APIs behave the same way
4. **Less code** - 40-60% reduction in boilerplate
5. **Type-safe** - TypeScript support built-in
6. **Debuggable** - Automatic logging in `apiFetch`

---

## 🧪 Testing

After migration, verify:

1. ✅ Flow Log shows events during API calls
2. ✅ Demo mode toggle changes API behavior
3. ✅ No console errors about missing `_flowEvents`
4. ✅ Trash button clears events
5. ✅ Events don't duplicate or reappear after clearing

---

## 📚 API Reference

### `apiResponse(data, options?)`
Creates a JSON response with automatic flow event tracking.

**Parameters:**
- `data: object` - Response data
- `options.status?: number` - HTTP status code (default: 200)
- `options.headers?: HeadersInit` - Additional headers
- `options.skipFlowEvents?: boolean` - Opt-out of flow tracking

**Returns:** `NextResponse`

### `apiError(error, status?, details?)`
Creates an error response with automatic flow event tracking.

**Parameters:**
- `error: string` - Error message
- `status?: number` - HTTP status code (default: 500)
- `details?: any` - Additional error details

**Returns:** `NextResponse`

### `apiFetch(url, options?)`
Enhanced fetch with automatic demo mode headers and flow event import.

**Parameters:**
- `url: string` - API endpoint
- `options?: RequestInit & { skipFlowTracking?: boolean }`

**Returns:** `Promise<Response>`

### `apiFetchJSON<T>(url, options?)`
Convenience wrapper for JSON API calls.

**Parameters:**
- `url: string` - API endpoint
- `options?: RequestInit & { skipFlowTracking?: boolean }`

**Returns:** `Promise<T>` - Parsed JSON response
**Throws:** Error if response not OK

---

## ✨ Future Enhancements

With this architecture, we can easily add:
- Global rate limiting
- Request/response logging
- Authentication headers
- Request retries
- Caching
- Analytics tracking

All without touching individual API routes or pages!
