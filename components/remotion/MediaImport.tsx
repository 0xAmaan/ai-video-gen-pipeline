"use client";

import { useState, useRef } from "react";
import { useTimelineStore } from "@/lib/remotion/timelineStore";
import { captureVideoThumbnail } from "@/lib/remotion/mediaHelpers";

interface Props {
  targetTrackId?: string;
}

const makeId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

const getFileDuration = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const media = document.createElement("video");
    media.preload = "metadata";
    media.src = url;
    media.onloadedmetadata = () => {
      const dur = media.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(dur) && dur > 0 ? dur : 0);
    };
    media.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
};

const getWaveform = async (file: File, samples = 80): Promise<number[] | undefined> => {
  if (!file.type.startsWith("audio")) return undefined;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const channel = audioBuffer.getChannelData(0);
    const blockSize = Math.floor(channel.length / samples);
    const waveform: number[] = [];
    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        const sample = channel[start + j];
        sum += Math.abs(sample);
      }
      waveform.push(Math.min(1, sum / blockSize * 2)); // normalize approx
    }
    audioCtx.close();
    return waveform;
  } catch (err) {
    console.warn("waveform decode failed", err);
    return undefined;
  }
};

/**
 * Local file import:
 * - Pick files from disk
 * - Detect duration (best effort)
 * - Append to the end of a track and show a small preview
 */
export const MediaImport = ({ targetTrackId }: Props) => {
  const { tracks, fps, actions, durationInFrames } = useTimelineStore();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"video" | "audio" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    const url = URL.createObjectURL(file);
    const durationSec = await getFileDuration(file);
    const durationFrames = Math.max(1, Math.round((durationSec || 5) * fps));

    // Choose track by type, fallback to first
    const kind = file.type.startsWith("audio") ? "audio" : "video";
    const track =
      targetTrackId
        ? tracks.find((t) => t.id === targetTrackId)
        : tracks.find((t) => t.type === kind) || tracks[0];
    if (!track) return;

    const waveform = kind === "audio" ? await getWaveform(file) : undefined;
    const thumbnail = kind === "video" ? await captureVideoThumbnail(url) : undefined;

    actions.addClip(track.id, {
      id: makeId(),
      trackId: track.id,
      assetUrl: url,
      name: file.name,
      startFrame: durationInFrames,
      durationInFrames: durationFrames,
      maxDurationFrames: durationFrames,
      trimStartFrames: 0,
      volume: 1,
      waveform,
      thumbnail,
    });

    setPreviewUrl(url);
    setPreviewType(kind);
  };

  return (
    <div className="border border-border rounded-lg bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Import Media (local)</div>
        <button
          className="text-sm px-3 py-1 rounded bg-primary text-primary-foreground"
          onClick={() => inputRef.current?.click()}
        >
          Choose File
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {previewUrl && (
        <div className="mt-3 space-y-2">
          <div className="text-xs text-muted-foreground">Preview</div>
          {previewType === "video" ? (
            <video src={previewUrl} controls className="w-full max-h-48 rounded border border-border" />
          ) : (
            <audio src={previewUrl} controls className="w-full" />
          )}
        </div>
      )}
      {!previewUrl && (
        <div className="text-xs text-muted-foreground">
          Select a local video or audio file to append it to the timeline.
        </div>
      )}
    </div>
  );
};
