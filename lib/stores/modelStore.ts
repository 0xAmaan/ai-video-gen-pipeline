import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ModelSelectionState,
  FeatureToggleState,
} from "@/lib/types/models";

export type ModelPreset = "fast-cheap" | "balanced" | "high-quality" | "custom";

interface ModelStore {
  // State
  textToTextModel: string;
  textToImageModel: string;
  imageToVideoModel: string;
  sceneRegenerationModel: string;
  modelSelectionEnabled: boolean;
  modelPreset: ModelPreset;

  // Actions
  setTextToTextModel: (modelId: string) => void;
  setTextToImageModel: (modelId: string) => void;
  setImageToVideoModel: (modelId: string) => void;
  setSceneRegenerationModel: (modelId: string) => void;
  setModelSelectionEnabled: (enabled: boolean) => void;
  setModelPreset: (preset: ModelPreset) => void;
  applyPreset: (preset: ModelPreset) => void;
  resetToDefaults: () => void;
  syncSceneRegenerationModel: () => void;
}

// Preset configurations
const PRESET_CONFIGS: Record<
  Exclude<ModelPreset, "custom">,
  {
    textToTextModel: string;
    textToImageModel: string;
    imageToVideoModel: string;
  }
> = {
  "fast-cheap": {
    textToTextModel: "openai/gpt-oss-20b",
    textToImageModel: "flux-schnell",
    imageToVideoModel: "wan-video/wan-2.5-i2v-fast",
  },
  balanced: {
    textToTextModel: "openai/gpt-4o-mini",
    textToImageModel: "leonardo-phoenix",
    imageToVideoModel: "wan-video/wan-2.5-i2v-fast",
  },
  "high-quality": {
    textToTextModel: "openai/gpt-4.1-mini",
    textToImageModel: "flux-pro",
    imageToVideoModel: "veo/veo-3.1",
  },
};

const DEFAULT_MODEL_SELECTION = {
  textToTextModel: "openai/gpt-oss-20b", // Fast default
  textToImageModel: "leonardo-phoenix", // From TEXT_TO_IMAGE_MODELS
  imageToVideoModel: "wan-video/wan-2.5-i2v-fast", // From IMAGE_TO_VIDEO_MODELS
  sceneRegenerationModel: "leonardo-phoenix", // Same as textToImageModel
  modelPreset: "balanced" as ModelPreset,
};

const DEFAULT_FEATURE_TOGGLE = {
  modelSelectionEnabled: true, // Enabled by default for debugging
};

export const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...DEFAULT_MODEL_SELECTION,
      ...DEFAULT_FEATURE_TOGGLE,

      // Actions
      setTextToTextModel: (modelId: string) => {
        console.log("🔧 Setting text-to-text model to:", modelId);
        console.log("🔧 Previous state:", get());
        set({ textToTextModel: modelId });
      },

      setTextToImageModel: (modelId: string) => {
        set((state) => ({
          textToImageModel: modelId,
          // Update scene regeneration model to match (PRD requirement)
          sceneRegenerationModel: modelId,
        }));
      },

      setImageToVideoModel: (modelId: string) => {
        set({ imageToVideoModel: modelId });
      },

      setSceneRegenerationModel: (modelId: string) => {
        set({ sceneRegenerationModel: modelId });
      },

      setModelSelectionEnabled: (enabled: boolean) => {
        set({ modelSelectionEnabled: enabled });
      },

      setModelPreset: (preset: ModelPreset) => {
        set({ modelPreset: preset });
        // If not custom, apply the preset
        if (preset !== "custom") {
          get().applyPreset(preset);
        }
      },

      applyPreset: (preset: ModelPreset) => {
        if (preset === "custom") {
          // Don't apply anything for custom - user controls individual models
          return;
        }

        const config = PRESET_CONFIGS[preset];
        set({
          textToTextModel: config.textToTextModel,
          textToImageModel: config.textToImageModel,
          imageToVideoModel: config.imageToVideoModel,
          sceneRegenerationModel: config.textToImageModel, // Keep in sync
          modelPreset: preset,
        });
      },

      resetToDefaults: () => {
        set({
          ...DEFAULT_MODEL_SELECTION,
          ...DEFAULT_FEATURE_TOGGLE,
        });
      },

      // Ensure scene regeneration model stays in sync with text-to-image model (PRD requirement)
      syncSceneRegenerationModel: () => {
        set((state) => ({
          sceneRegenerationModel: state.textToImageModel,
        }));
      },
    }),
    {
      name: "model-selection-store",
      partialize: (state) => ({
        textToTextModel: state.textToTextModel,
        textToImageModel: state.textToImageModel,
        imageToVideoModel: state.imageToVideoModel,
        sceneRegenerationModel: state.sceneRegenerationModel,
        modelSelectionEnabled: state.modelSelectionEnabled,
        modelPreset: state.modelPreset,
      }),
      onRehydrateStorage: () => (state) => {
        console.log("🔄 Store rehydrated with state:", state);
      },
    },
  ),
);

// Selector hooks for specific state slices
export const useTextToTextModel = () => {
  const model = useModelStore((state) => state.textToTextModel);
  console.log("🔍 Current text-to-text model from store:", model);
  return model;
};
export const useTextToImageModel = () =>
  useModelStore((state) => state.textToImageModel);
export const useImageToVideoModel = () =>
  useModelStore((state) => state.imageToVideoModel);
export const useSceneRegenerationModel = () =>
  useModelStore((state) => state.sceneRegenerationModel);
export const useModelSelectionEnabled = () => {
  const enabled = useModelStore((state) => state.modelSelectionEnabled);
  console.log("🔍 Model selection enabled:", enabled);
  return enabled;
};
