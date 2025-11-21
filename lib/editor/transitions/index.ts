/**
 * Transitions Module
 *
 * Provides transition presets and rendering capabilities for video clips.
 */

export {
  type TransitionType,
  type EasingFunction,
  type TransitionPreset,
  TRANSITION_PRESETS,
  easingFunctions,
  getPresetById,
  getPresetsByCategory,
  createTransitionFromPreset,
} from "./presets";

export {
  type TransitionRenderContext,
  renderTransition,
} from "./renderer";
