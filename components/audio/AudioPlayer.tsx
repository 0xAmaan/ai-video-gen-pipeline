"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

type AudioPlayerProps = Omit<
  React.AudioHTMLAttributes<HTMLAudioElement>,
  "src"
> & {
  /**
   * Logical name that will be included in log statements.
   */
  label?: string;
  /**
   * Audio source that should be loaded into the player.
   */
  src?: string | null;
  /** Extra metadata included in debug logs (provider info, upstream ids, etc.). */
  debugContext?: Record<string, unknown>;
};

export const AudioPlayer = forwardRef<HTMLAudioElement | null, AudioPlayerProps>(
  (
    {
      label = "AudioPlayer",
      src,
      debugContext,
      className,
      preload = "metadata",
      controls = true,
      ...rest
    },
    ref,
  ) => {
    const localRef = useRef<HTMLAudioElement>(null);

    useImperativeHandle<HTMLAudioElement | null, HTMLAudioElement | null>(
      ref,
      () => localRef.current,
    );

    useEffect(() => {
      if (!src) {
        console.warn("[AudioPlayer] No src provided", {
          label,
          context: debugContext,
        });
        return;
      }
      console.log("[AudioPlayer] Source received", {
        label,
        src,
        context: debugContext,
      });
    }, [src, label, debugContext]);

    useEffect(() => {
      const element = localRef.current;
      if (!element) return;

      const logEvent = (level: "log" | "warn" | "error", message: string) => {
        const payload = {
          label,
          src: element.currentSrc || src,
          duration: Number.isFinite(element.duration)
            ? element.duration
            : undefined,
          context: debugContext,
        };
        console[level](`[AudioPlayer] ${message}`, payload);
      };

      const handleLoadedMetadata = () => {
        logEvent("log", "Metadata loaded");
      };
      const handlePlay = () => {
        logEvent("log", "Playback started");
      };
      const handlePause = () => {
        logEvent("log", "Playback paused");
      };
      const handleStalled = () => {
        logEvent("warn", "Playback stalled");
      };
      const handleError = () => {
        const mediaError = element.error;
        console.error("[AudioPlayer] Playback error", {
          label,
          src: element.currentSrc || src,
          code: mediaError?.code,
          message: mediaError?.message,
          context: debugContext,
        });
      };

      element.addEventListener("loadedmetadata", handleLoadedMetadata);
      element.addEventListener("play", handlePlay);
      element.addEventListener("pause", handlePause);
      element.addEventListener("stalled", handleStalled);
      element.addEventListener("error", handleError);

      return () => {
        element.removeEventListener("loadedmetadata", handleLoadedMetadata);
        element.removeEventListener("play", handlePlay);
        element.removeEventListener("pause", handlePause);
        element.removeEventListener("stalled", handleStalled);
        element.removeEventListener("error", handleError);
      };
    }, [label, src, debugContext]);

    return (
      <audio
        ref={localRef}
        className={cn("w-full", className)}
        src={src ?? undefined}
        preload={preload}
        controls={controls}
        {...rest}
      >
        Your browser does not support the audio element.
      </audio>
    );
  },
);

AudioPlayer.displayName = "AudioPlayer";
