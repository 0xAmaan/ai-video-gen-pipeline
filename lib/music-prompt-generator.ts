type NullableString = string | null | undefined;

export type PromptableShot = {
  description?: NullableString;
  mood?: NullableString;
  shotNumber?: number | null;
  selectedImagePrompt?: NullableString;
};

export type PromptableScene = {
  title?: NullableString;
  description?: NullableString;
  sceneNumber?: number | null;
  shots?: PromptableShot[];
};

export interface MusicPromptContext {
  durationSeconds: number;
  projectPrompt?: NullableString;
  scenes?: PromptableScene[];
}

export interface MusicPromptResult {
  prompt: string;
  negativePrompt: string;
  moodKeywords: string[];
  paceKeywords: string[];
  styleKeywords: string[];
  arcDescription: string;
}

const MOOD_KEYWORDS = [
  "dramatic",
  "uplifting",
  "tense",
  "playful",
  "serene",
  "epic",
  "melancholic",
  "hopeful",
  "gritty",
  "elegant",
  "luxury",
  "dreamy",
  "dark",
  "mysterious",
  "energetic",
  "inspiring",
  "romantic",
  "urgent",
  "suspenseful",
  "confident",
  "cinematic",
];

const STYLE_KEYWORDS = [
  "cinematic",
  "orchestral",
  "electronic",
  "synthwave",
  "ambient",
  "acoustic",
  "piano",
  "strings",
  "percussion",
  "drum and bass",
  "house",
  "trap",
  "lofi",
  "retro",
  "modern",
  "minimalist",
  "industrial",
  "organic",
];

const PACE_KEYWORDS = [
  "fast-paced",
  "high energy",
  "slow motion",
  "steady",
  "driving",
  "dynamic",
  "calm",
  "building",
  "rising",
  "pulse",
  "rhythmic",
  "heartbeat",
  "adrenaline",
  "chase",
];

const collectText = (value?: NullableString) =>
  (value ?? "")
    .toString()
    .replace(/\s+/g, " ")
    .trim();

const findKeywords = (haystack: string, keywords: string[]) => {
  const lower = haystack.toLowerCase();
  return keywords.filter((keyword) => lower.includes(keyword));
};

const uniq = (values: string[]) =>
  Array.from(new Set(values.filter((value) => value && value.length > 0)));

const formatList = (values: string[], fallback: string) =>
  values.length > 0 ? values.join(", ") : fallback;

const buildPacingLine = (pace: string[], durationSeconds: number) => {
  if (pace.some((p) => /fast|high energy|adrenaline|chase/.test(p))) {
    return `Keep an energetic, tightly edited pace with clear downbeats every ~${Math.max(3, Math.round(durationSeconds / 4))}s.`;
  }
  if (pace.some((p) => /slow|calm/.test(p))) {
    return "Maintain a steady, flowing tempo with gentle swells instead of sharp drops.";
  }
  if (pace.some((p) => /driving|pulse|rhythmic/.test(p))) {
    return "Use a modern driving pulse with clean percussion to keep momentum between cuts.";
  }
  return "Use a modern cinematic pace with defined sections that line up to scene changes.";
};

const buildArc = (durationSeconds: number, moods: string[]) => {
  const intro = Math.max(3, Math.round(durationSeconds * 0.25));
  const midpoint = Math.max(
    4,
    Math.min(durationSeconds - intro - 2, Math.round(durationSeconds * 0.45)),
  );
  const outro = Math.max(2, durationSeconds - intro - midpoint);
  const moodDescriptor =
    moods.find((m) => m !== "cinematic") ?? "cinematic and focused";

  return `Arc: open with a ${moodDescriptor} intro for ~${intro}s, build layered intensity through ~${midpoint}s, and finish with a clean resolve for the final ~${outro}s.`;
};

const buildNegativePrompt = (moods: string[]) => {
  const base = [
    "dialogue",
    "speech",
    "vocals",
    "narration",
    "whispering",
    "crowd noise",
  ];

  if (moods.some((mood) => ["serene", "calm", "dreamy"].includes(mood))) {
    base.push("harsh distortion", "aggressive guitars", "glitchy artifacts");
  }
  if (moods.some((mood) => ["luxury", "elegant"].includes(mood))) {
    base.push("comedic", "playful", "childish", "8-bit", "lo-fi artifacts");
  }
  if (moods.some((mood) => ["gritty", "dark"].includes(mood))) {
    base.push("cheesy brass stabs", "whimsical", "quirky ukulele");
  }

  return uniq(base).join(", ");
};

export const generateMusicPromptFromVisuals = (
  context: MusicPromptContext,
): MusicPromptResult => {
  const { durationSeconds } = context;
  const gathered: string[] = [];

  if (context.projectPrompt) {
    gathered.push(collectText(context.projectPrompt));
  }

  const scenes = context.scenes ?? [];
  scenes.forEach((scene) => {
    if (scene.title) gathered.push(collectText(scene.title));
    if (scene.description) gathered.push(collectText(scene.description));
    (scene.shots ?? []).forEach((shot) => {
      if (shot.description) gathered.push(collectText(shot.description));
      if (shot.mood) gathered.push(collectText(shot.mood));
      if (shot.selectedImagePrompt) {
        gathered.push(collectText(shot.selectedImagePrompt));
      }
    });
  });

  const combined = gathered.join(" ").trim();
  const moodKeywords = uniq(findKeywords(combined, MOOD_KEYWORDS));
  const styleKeywords = uniq(findKeywords(combined, STYLE_KEYWORDS));
  const paceKeywords = uniq(findKeywords(combined, PACE_KEYWORDS));

  const genreDescriptor =
    styleKeywords[0] ??
    (moodKeywords.includes("luxury") || moodKeywords.includes("elegant")
      ? "cinematic orchestral"
      : "modern cinematic");
  const moodDescriptor = formatList(
    moodKeywords,
    "cinematic, confident, focused",
  );
  const styleDescriptor = formatList(
    styleKeywords,
    "polished, modern production with clean percussion",
  );

  const pacingDescription = buildPacingLine(paceKeywords, durationSeconds);
  const arcDescription = buildArc(durationSeconds, moodKeywords);
  const negativePrompt = buildNegativePrompt(moodKeywords);

  const prompt = [
    `Create a ${durationSeconds} second ${genreDescriptor} soundtrack for a dialogue-free video edit.`,
    pacingDescription,
    `Mood: ${moodDescriptor}. Style: ${styleDescriptor}.`,
    arcDescription,
    "Keep instrumentation balanced for background use and avoid sudden endings.",
  ].join(" ");

  return {
    prompt,
    negativePrompt,
    moodKeywords,
    paceKeywords,
    styleKeywords,
    arcDescription,
  };
};
