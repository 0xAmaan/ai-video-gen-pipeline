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
