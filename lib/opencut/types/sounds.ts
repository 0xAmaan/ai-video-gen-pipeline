// Stub types for OpenCut sounds (external package not installed)
export interface SoundEffect {
  id: number;
  name: string;
  description: string;
  url: string;
  previewUrl?: string;
  downloadUrl?: string;
  duration: number;
  filesize: number;
  type: string;
  channels: number;
  bitrate: number;
  bitdepth: number;
  samplerate: number;
  username: string;
  tags: string[];
  license: string;
  created: string;
  downloads: number;
  rating: number;
  ratingCount: number;
}

export interface SavedSound {
  id: number;
  name: string;
  username: string;
  previewUrl?: string;
  downloadUrl?: string;
  duration: number;
  tags: string[];
  license: string;
  savedAt: string;
}

export interface SavedSoundsData {
  sounds: SavedSound[];
  lastModified: string;
}
