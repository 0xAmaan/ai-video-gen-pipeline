import type { BeatMarker } from "@/types/audio";

export const DEFAULT_BEAT_SNAP_TOLERANCE = 0.12; // seconds

export const snapTimeToBeatMarkers = (
  time: number,
  beats: BeatMarker[],
  tolerance: number = DEFAULT_BEAT_SNAP_TOLERANCE,
): number => {
  if (!beats.length) return time;
  let closest = time;
  let minDelta = Number.POSITIVE_INFINITY;

  for (const beat of beats) {
    const delta = Math.abs(beat.time - time);
    if (delta < minDelta && delta <= tolerance) {
      minDelta = delta;
      closest = beat.time;
    }
  }

  return closest;
};

export const suggestSceneCutPoints = (
  beats: BeatMarker[],
  options: {
    beatsPerCut?: number;
    minStrength?: number;
  } = {},
): number[] => {
  const beatsPerCut = options.beatsPerCut ?? 4;
  const minStrength = options.minStrength ?? 0;

  if (!beats.length) return [];

  const cutPoints: number[] = [];
  let counter = 0;

  for (const beat of beats) {
    if (beat.strength !== undefined && beat.strength < minStrength) {
      counter++;
      continue;
    }
    if (counter % beatsPerCut === 0) {
      cutPoints.push(beat.time);
    }
    counter++;
  }

  return cutPoints;
};

export const calculatePhraseDuration = (
  bpm: number,
  beatsPerPhrase = 8,
): number => {
  if (!bpm || bpm <= 0) return 0;
  const secondsPerBeat = 60 / bpm;
  return secondsPerBeat * beatsPerPhrase;
};

export const alignDurationToPhrase = (
  duration: number,
  bpm: number,
  beatsPerPhrase = 8,
): number => {
  const phraseDuration = calculatePhraseDuration(bpm, beatsPerPhrase);
  if (phraseDuration <= 0) return duration;
  const phrases = Math.max(1, Math.round(duration / phraseDuration));
  return phrases * phraseDuration;
};
