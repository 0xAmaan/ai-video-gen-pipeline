// Stub types for OpenCut project (external package not installed)
export interface TProject {
  id: string;
  name: string;
  width: number;
  height: number;
  frameRate: number;
  duration: number;
  mediaAssets: Record<string, unknown>;
  currentSceneId?: string;
  [key: string]: unknown;
}
