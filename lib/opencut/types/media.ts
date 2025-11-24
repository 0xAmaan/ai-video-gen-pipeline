// Stub types for OpenCut media (external package not installed)
export type MediaType = "image" | "video" | "audio";

export interface MediaFile {
  id: string;
  name: string;
  type: MediaType;
  file: File;
  url?: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  ephemeral?: boolean;
}
