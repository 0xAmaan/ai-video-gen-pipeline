// Stub types for OpenCut project (external package not installed)
export type BlurIntensity = 4 | 8 | 18;

export interface Scene {
  id: string;
  name: string;
  isMain: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export interface TProject {
  id: string;
  name: string;
  thumbnail: string;
  createdAt: Date;
  updatedAt: Date;
  scenes: Scene[];
  currentSceneId: string;
  mediaItems?: string[];
  backgroundColor?: string;
  backgroundType?: "color" | "blur";
  blurIntensity?: BlurIntensity;
  fps?: number;
  bookmarks?: number[];
  canvasSize: CanvasSize;
  canvasMode: "preset" | "original" | "custom";
  // Legacy/editor-only fields
  width?: number;
  height?: number;
  frameRate?: number;
  duration?: number;
  mediaAssets?: Record<string, unknown>;
}
