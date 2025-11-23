"use client";

import { Audio, Sequence, Video } from "remotion";
import type { TimelineState } from "@/lib/remotion/timelineStore";

interface Props {
  timeline: TimelineState;
}

/**
 * Declarative Remotion composition that maps tracks/clips into Sequences.
 * Video and audio clips are placed using startFrame/durationInFrames.
 */
export const TimelineComposition = ({ timeline }: Props) => {
  return (
    <>
      {timeline.tracks.map((track) =>
        track.clips.map((clip) => (
          <Sequence
            key={clip.id}
            from={clip.startFrame}
            durationInFrames={clip.durationInFrames}
          >
            {track.type === "audio" ? (
              <Audio
                src={clip.assetUrl}
                startFrom={clip.trimStartFrames ?? 0}
                volume={clip.volume ?? 1}
              />
            ) : (
              <Video
                src={clip.assetUrl}
                startFrom={clip.trimStartFrames ?? 0}
                volume={clip.volume ?? 1}
              />
            )}
          </Sequence>
        )),
      )}
    </>
  );
};
