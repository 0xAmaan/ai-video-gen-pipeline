// Stub types for OpenCut sounds (external package not installed)
export interface SoundEffect {
  id: number;
  name: string;
  username: string;
  previewUrl: string;
  downloadUrl: string;
  duration: number;
  tags: string[];
  license: string;
  [key: string]: unknown;
}

export interface SavedSound {
  id: number;
  name: string;
  username: string;
  previewUrl: string;
  downloadUrl: string;
  duration: number;
  tags: string[];
  license: string;
  savedAt: string;
}

export interface SavedSoundsData {
  sounds: SavedSound[];
  lastModified: string;
}
