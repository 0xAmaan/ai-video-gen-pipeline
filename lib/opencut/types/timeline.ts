// Stub types for OpenCut timeline (external package not installed)
export type TrackType = "media" | "text" | "audio";

interface BaseTimelineElement {
  id: string;
  name: string;
  duration: number;
  startTime: number;
  trimStart: number;
  trimEnd: number;
  hidden?: boolean;
}

export interface MediaElement extends BaseTimelineElement {
  type: "media";
  mediaId: string;
  muted?: boolean;
}

export interface TextElement extends BaseTimelineElement {
  type: "text";
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  textAlign: "left" | "center" | "right";
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  textDecoration: "none" | "underline" | "line-through";
  x: number;
  y: number;
  rotation: number;
  opacity: number;
}

export type TimelineElement = MediaElement | TextElement;

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  elements: TimelineElement[];
  muted?: boolean;
  isMain?: boolean;
}
