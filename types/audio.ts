export type AudioAssetType = "bgm" | "sfx" | "narration" | "voiceover";
export type AudioAssetSource =
  | "generated"
  | "freesound"
  | "uploaded"
  | "external";

export type BeatMarker = {
  time: number;
  strength?: number;
};

export interface AudioAsset {
  id: string;
  projectId: string;
  sceneId?: string;
  type: AudioAssetType;
  source: AudioAssetSource;
  provider?: string;
  modelKey?: string;
  url: string;
  duration?: number;
  prompt?: string;
  mood?: string;
  timelineStart?: number;
  timelineEnd?: number;
  beatMarkers?: BeatMarker[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface MusicGenerationOptions {
  prompt: string;
  model?: "musicgen" | "lyria-2" | "bark";
  duration?: number;
  negative_prompt?: string;
  seed?: number;
  history_prompt?: string | null;
  text_temp?: number;
  waveform_temp?: number;
}
