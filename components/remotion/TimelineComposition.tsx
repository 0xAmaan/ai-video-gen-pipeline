"use client";

import { Audio, Sequence, Video, AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import type { TimelineState, Clip } from "@/lib/remotion/timelineStore";

interface Props {
  timeline: TimelineState;
}

const getFadeOpacity = (frame: number, clip: Clip) => {
  const fadeIn = clip.fadeInFrames ?? 0;
  const fadeOut = clip.fadeOutFrames ?? 0;
  const start = clip.startFrame;
  const end = clip.startFrame + clip.durationInFrames;

  // Fade in
  const fadeInOpacity =
    fadeIn > 0
      ? interpolate(frame, [start, start + fadeIn], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 1;

  // Fade out
  const fadeOutOpacity =
    fadeOut > 0
      ? interpolate(frame, [end - fadeOut, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 1;

  return Math.min(fadeInOpacity, fadeOutOpacity);
};

/**
 * Declarative Remotion composition that maps tracks/clips into Sequences.
 * Video and audio clips are placed using startFrame/durationInFrames.
 */
export const TimelineComposition = ({ timeline }: Props) => {
  const frame = useCurrentFrame();
  return (
    <>
      {/* Background fill to avoid black gaps */}
      <AbsoluteFill style={{ backgroundColor: "black" }} />

      {timeline.tracks.map((track, z) =>
        track.clips.map((clip) => (
          <Sequence
            key={clip.id}
            from={clip.startFrame}
            durationInFrames={clip.durationInFrames}
            layout="absolute-fill"
          >
            {(() => {
              const baseVolume = clip.volume ?? 1;
              const opacity = (clip.opacity ?? 1) * getFadeOpacity(frame, clip);
              const mutedByTrack = track.muted;
              if (track.type === "audio") {
                return (
                  <Audio
                    src={clip.assetUrl}
                    startFrom={clip.trimStartFrames ?? 0}
                    volume={mutedByTrack ? 0 : baseVolume * opacity}
                  />
                );
              }
              return (
                <Video
                  src={clip.assetUrl}
                  startFrom={clip.trimStartFrames ?? 0}
                  volume={mutedByTrack ? 0 : baseVolume}
                  style={{ opacity }}
                />
              );
            })()}
          </Sequence>
        )),
      )}
    </>
  );
};
