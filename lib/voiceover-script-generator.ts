type VoiceoverScriptScene = {
  sceneNumber?: number;
  title?: string | null;
  description?: string | null;
  durationSeconds?: number;
};

type VoiceoverScriptInput = {
  projectPrompt?: string | null;
  projectTitle?: string | null;
  durationSeconds?: number;
  scenes?: VoiceoverScriptScene[];
};

type VoiceoverScriptResult = {
  script: string;
  talkingPoints: string[];
  targetWordCount: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const wordCount = (text: string) =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const truncateWords = (text: string, maxWords: number) => {
  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ");
};

const describeScene = (scene: VoiceoverScriptScene) => {
  const base =
    scene.description?.trim() ||
    scene.title?.trim() ||
    "a key product moment";
  const words = base
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 22)
    .join(" ");
  if (scene.sceneNumber) {
    return `Scene ${scene.sceneNumber}: ${words}.`;
  }
  return `${words}.`;
};

export const generateVoiceoverScript = (
  input: VoiceoverScriptInput,
): VoiceoverScriptResult => {
  const scenes = (input.scenes ?? []).slice().sort((a, b) => {
    if (a.sceneNumber === undefined) return 1;
    if (b.sceneNumber === undefined) return -1;
    return a.sceneNumber - b.sceneNumber;
  });

  const productName =
    input.projectTitle?.trim() ||
    (input.projectPrompt?.trim() ? "this product" : "your brand");
  const projectPrompt = input.projectPrompt?.trim() ?? "";
  const baseDuration =
    input.durationSeconds ??
    (scenes.length > 0 ? scenes.length * 6 : 30);
  const targetWords = clamp(Math.round(baseDuration * 2.1), 40, 180);

  const hook = projectPrompt
    ? `Introducing ${productName} - ${truncateWords(projectPrompt, 26)}.`
    : `Introducing ${productName}.`;
  const sceneLines: string[] = [];

  let runningCount = wordCount(hook);
  for (const scene of scenes) {
    const line = describeScene(scene);
    const nextCount = runningCount + wordCount(line);
    if (nextCount > targetWords + 20) break;
    sceneLines.push(line);
    runningCount = nextCount;
  }

  const closeLine = `See how ${productName} fits your day. Try it today.`;
  const scriptParts = [hook, ...sceneLines, closeLine].filter(Boolean);
  const script = scriptParts.join(" ").replace(/\s+/g, " ").trim();

  return {
    script: script.replace(/^\s*\[?\s*voiceover\]?:?\s*/i, ""),
    talkingPoints: sceneLines,
    targetWordCount: targetWords,
  };
};
