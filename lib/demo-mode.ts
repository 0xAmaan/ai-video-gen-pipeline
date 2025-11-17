/**
 * Demo Mode Configuration
 *
 * Provides three mutually exclusive modes for development:
 * - OFF: Normal production behavior
 * - NO_COST: Mock all API calls, instant responses, no actual inference
 * - CHEAP: Use cheapest/fastest models for real inference
 * - REAL: Production-quality models (current default behavior)
 */

export type DemoMode = "off" | "no-cost" | "cheap" | "real";

// Global demo mode state (only active in development)
let currentDemoMode: DemoMode = "off";

export const isDevelopment = () => {
  return process.env.NODE_ENV === "development";
};

export const getDemoMode = (): DemoMode => {
  if (!isDevelopment()) {
    return "off";
  }

  // Server-side: check if we're on the server (no window)
  if (typeof window === "undefined") {
    return "off";
  }

  // Client-side: read from localStorage first, fallback to currentDemoMode
  const stored = localStorage.getItem("demo-mode");

  if (stored && ["off", "no-cost", "cheap", "real"].includes(stored)) {
    return stored as DemoMode;
  }

  return currentDemoMode;
};

export const setDemoMode = (mode: DemoMode) => {
  if (!isDevelopment()) {
    console.warn("Demo mode can only be set in development");
    return;
  }
  currentDemoMode = mode;

  // Store in localStorage for persistence across page reloads
  if (typeof window !== "undefined") {
    localStorage.setItem("demo-mode", mode);
    console.log(`[Demo Mode] Set to: ${mode}`);
  }
};

export const initDemoMode = () => {
  if (!isDevelopment()) return;

  // Try to restore from localStorage
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("demo-mode") as DemoMode | null;
    if (stored && ["off", "no-cost", "cheap", "real"].includes(stored)) {
      currentDemoMode = stored;
      console.log(`[Demo Mode] Restored from localStorage: ${stored}`);
    }
  }
};

// For API routes: get demo mode from request headers
export const getDemoModeFromHeaders = (headers: Headers): DemoMode => {
  if (!isDevelopment()) {
    return "off";
  }

  const mode = headers.get("x-demo-mode") as DemoMode | null;

  if (mode && ["off", "no-cost", "cheap", "real"].includes(mode)) {
    return mode;
  }

  return "off";
};

// Model configurations for each mode
export const MODEL_CONFIGS = {
  "no-cost": {
    // No actual models - will use mocks
    enabled: false,
  },
  cheap: {
    enabled: true,
    models: {
      // Video generation - WAN 2.5 i2v Fast (same as real, already optimized)
      video: {
        name: "wan-video-fast",
        id: "wan-video/wan-2.5-i2v-fast",
        version:
          "66226b38d223f8ac7a81aa33b8519759e300c2f9818a215e32900827ad6d2db5",
        cost: 0.34, // Same as real (no cheaper alternative available)
      },
      // Image generation - FLUX Schnell (90% cheaper than Leonardo Phoenix)
      image: {
        name: "FLUX Schnell",
        id: "black-forest-labs/flux-schnell",
        version: "",
        cost: 0.003, // 90% savings from $0.032
      },
      // LLM - prefer Groq for speed
      llm: "groq",
      // Audio - MiniMax (same as default, already cheap)
      audio: "minimax",
    },
  },
  real: {
    enabled: true,
    models: {
      // Production models - uses sophisticated selectImageModel() for images
      video: {
        name: "WAN 2.5 i2v Fast",
        id: "wan-video/wan-2.5-i2v-fast",
        version:
          "66226b38d223f8ac7a81aa33b8519759e300c2f9818a215e32900827ad6d2db5",
        cost: 0.34,
      },
      // Image model selected dynamically via selectImageModel()
      // Could be Leonardo Phoenix, FLUX Pro, SDXL, etc. based on preferences
      image: {
        name: "Dynamically Selected",
        id: "varies",
        version: "",
        cost: 0.032, // Average (Leonardo Phoenix default)
      },
      llm: "openai", // Higher quality
      audio: "minimax",
    },
  },
} as const;

export const shouldMockAPIs = () => {
  return getDemoMode() === "no-cost";
};

export const shouldUseCheapModels = () => {
  return getDemoMode() === "cheap";
};

export const getModelConfig = () => {
  const mode = getDemoMode();
  if (mode === "off" || mode === "no-cost") {
    return MODEL_CONFIGS["real"]; // Default to real config structure
  }
  return MODEL_CONFIGS[mode];
};
