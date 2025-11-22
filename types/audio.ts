export type AudioAssetType = "bgm" | "sfx" | "narration" | "voiceover";
export type AudioAssetSource =
  | "generated"
  | "freesound"
  | "uploaded"
  | "external";

export type BeatAnalysisStatus =
  | "not_analyzed"
  | "analyzing"
  | "completed"
  | "failed"
  | "rate_limited";

export type BeatAnalysisMethod = "replicate" | "client" | "manual";

export type BeatMarker = {
  time: number;
  strength?: number;
  isDownbeat?: boolean;
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
  bpm?: number;
  beatAnalysisStatus?: BeatAnalysisStatus;
  analysisError?: string;
  analysisMethod?: BeatAnalysisMethod;
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
