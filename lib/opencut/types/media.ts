// Stub types for OpenCut media (external package not installed)
export interface MediaFile {
  id: string;
  name: string;
  url: string;
  type: string;
  duration?: number;
  width?: number;
  height?: number;
  size?: number;
  thumbnailUrl?: string;
  [key: string]: unknown;
}
