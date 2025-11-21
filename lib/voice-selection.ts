export const MINIMAX_VOICE_IDS = [
  "Wise_Woman",
  "Friendly_Person",
  "Inspirational_girl",
  "Deep_Voice_Man",
  "Calm_Woman",
  "Professional_Man",
  "Storyteller",
  "News_Anchor",
] as const;

export type MiniMaxVoiceId = (typeof MINIMAX_VOICE_IDS)[number];

export const MINIMAX_EMOTIONS = [
  "auto",
  "happy",
  "sad",
  "angry",
  "fearful",
  "disgusted",
  "surprised",
  "calm",
  "fluent",
  "neutral",
] as const;

export type MiniMaxEmotion = (typeof MINIMAX_EMOTIONS)[number];

export interface MiniMaxVoiceDefinition {
  id: MiniMaxVoiceId;
  name: string;
  description: string;
  idealUseCases: string[];
  defaultEmotion: MiniMaxEmotion;
  defaultSpeed: number;
  defaultPitch: number;
  sampleAudioUrl?: string;
}

export interface VoiceSelectionInput {
  prompt: string;
  responses?: Record<string, unknown> | null;
}

export interface VoiceSelectionResult {
  voiceId: MiniMaxVoiceId;
  voiceName: string;
  emotion: MiniMaxEmotion;
  speed: number;
  pitch: number;
  reasoning: string;
}

export const MINIMAX_VOICES: Record<MiniMaxVoiceId, MiniMaxVoiceDefinition> = {
  Wise_Woman: {
    id: "Wise_Woman",
    name: "Wise Woman",
    description: "Calm, authoritative narrator ideal for documentaries and educational content.",
    idealUseCases: ["documentary", "educational", "historical", "thoughtful"],
    defaultEmotion: "calm",
    defaultSpeed: 1,
    defaultPitch: 0,
  },
  Friendly_Person: {
    id: "Friendly_Person",
    name: "Friendly Person",
    description: "Warm, conversational delivery that feels approachable and upbeat.",
    idealUseCases: ["tutorial", "casual", "friendly", "kids"],
    defaultEmotion: "happy",
    defaultSpeed: 1.05,
    defaultPitch: 0.5,
  },
  Inspirational_girl: {
    id: "Inspirational_girl",
    name: "Inspirational Girl",
    description: "Energetic, youthful energy perfect for motivational or kids content.",
    idealUseCases: ["motivational", "kids", "uplifting", "fun"],
    defaultEmotion: "happy",
    defaultSpeed: 1.08,
    defaultPitch: 0.8,
  },
  Deep_Voice_Man: {
    id: "Deep_Voice_Man",
    name: "Deep Voice Man",
    description: "Powerful, dramatic male narrator suited for trailers and high-stakes stories.",
    idealUseCases: ["dramatic", "cinematic", "thriller", "trailer", "horror"],
    defaultEmotion: "auto",
    defaultSpeed: 0.95,
    defaultPitch: -0.3,
  },
  Calm_Woman: {
    id: "Calm_Woman",
    name: "Calm Woman",
    description: "Soothing delivery that works well for meditation and wellness content.",
    idealUseCases: ["meditation", "wellness", "calm", "sleep", "relax"],
    defaultEmotion: "calm",
    defaultSpeed: 0.92,
    defaultPitch: 0.2,
  },
  Professional_Man: {
    id: "Professional_Man",
    name: "Professional Man",
    description: "Clear, business-like delivery for corporate, product, or instructional videos.",
    idealUseCases: ["corporate", "business", "finance", "product"],
    defaultEmotion: "neutral",
    defaultSpeed: 1,
    defaultPitch: 0,
  },
  Storyteller: {
    id: "Storyteller",
    name: "Storyteller",
    description: "Engaging narrative tone that keeps audiences hooked.",
    idealUseCases: ["story", "narrative", "drama", "travel", "adventure"],
    defaultEmotion: "auto",
    defaultSpeed: 1,
    defaultPitch: 0.2,
  },
  News_Anchor: {
    id: "News_Anchor",
    name: "News Anchor",
    description: "Neutral, informative tone for news-style or factual content.",
    idealUseCases: ["news", "informational", "update", "briefing"],
    defaultEmotion: "neutral",
    defaultSpeed: 1,
    defaultPitch: 0,
  },
};

type VoiceRule = {
  category: string;
  keywords: string[];
  preferredVoices: MiniMaxVoiceId[];
  emotion?: MiniMaxEmotion;
  speed?: number;
  pitch?: number;
  reasoning: string;
};

const VOICE_RULES: VoiceRule[] = [
  {
    category: "documentary",
    keywords: ["documentary", "educational", "history", "historical", "explainer", "learning", "lesson"],
    preferredVoices: ["Wise_Woman", "Professional_Man"],
    emotion: "calm",
    reasoning: "Documentary or educational tone benefits from authoritative narrators.",
  },
  {
    category: "kids",
    keywords: ["kid", "kids", "child", "children", "playful", "fun", "cartoon", "colorful", "toy"],
    preferredVoices: ["Friendly_Person", "Inspirational_girl"],
    emotion: "happy",
    speed: 1.08,
    reasoning: "Kids or playful content sounds best with energetic, friendly voices.",
  },
  {
    category: "dramatic",
    keywords: ["dramatic", "cinematic", "epic", "intense", "trailer", "heroic", "battle", "climactic"],
    preferredVoices: ["Deep_Voice_Man", "Storyteller"],
    emotion: "auto",
    speed: 0.97,
    reasoning: "Dramatic narratives need bold, cinematic delivery.",
  },
  {
    category: "corporate",
    keywords: ["corporate", "business", "enterprise", "b2b", "boardroom", "pitch deck", "investor", "professional"],
    preferredVoices: ["Professional_Man"],
    emotion: "neutral",
    reasoning: "Business-focused messaging requires clear, professional narration.",
  },
  {
    category: "meditation",
    keywords: ["meditation", "calm", "relax", "sleep", "wellness", "soothing", "breathe", "mindfulness"],
    preferredVoices: ["Calm_Woman"],
    emotion: "calm",
    speed: 0.9,
    reasoning: "Meditative scripts pair well with soft, relaxing delivery.",
  },
  {
    category: "news",
    keywords: ["news", "update", "breaking", "report", "daily briefing", "newsletter"],
    preferredVoices: ["News_Anchor", "Professional_Man"],
    emotion: "neutral",
    reasoning: "News-style content calls for neutral, informative narration.",
  },
  {
    category: "motivational",
    keywords: ["motivation", "motivational", "uplift", "inspire", "empower", "success", "journey"],
    preferredVoices: ["Inspirational_girl", "Friendly_Person"],
    emotion: "happy",
    speed: 1.05,
    reasoning: "Motivational content sounds best with uplifting, energetic delivery.",
  },
  {
    category: "horror",
    keywords: ["horror", "thriller", "mystery", "dark", "spooky", "ghost", "ominous"],
    preferredVoices: ["Deep_Voice_Man"],
    emotion: "auto",
    speed: 0.9,
    reasoning: "Horror or thriller scenes need deep, slow narration for tension.",
  },
];

const DEFAULT_VOICE_ID: MiniMaxVoiceId = "Wise_Woman";

function serializeResponses(responses?: Record<string, unknown> | null): string {
  if (!responses) {
    return "";
  }

  try {
    return JSON.stringify(responses).toLowerCase();
  } catch {
    return String(responses);
  }
}

function deriveEmotionFromContext(text: string): MiniMaxEmotion {
  if (/(sad|tragic|heartbreaking|loss|melancholy|grief)/i.test(text)) {
    return "sad";
  }

  if (/(energetic|action|fast-paced|adventure|sports|high energy)/i.test(text)) {
    return "fluent";
  }

  if (/(motivational|uplifting|inspiring|celebration)/i.test(text)) {
    return "happy";
  }

  if (/(serious|documentary|educational|informational|professional)/i.test(text)) {
    return "neutral";
  }

  if (/(meditation|calm|relax|soothing|wellness)/i.test(text)) {
    return "calm";
  }

  return "auto";
}

export function selectVoiceForPrompt({
  prompt,
  responses,
}: VoiceSelectionInput): VoiceSelectionResult {
  const combinedText = `${prompt} ${serializeResponses(responses)}`.toLowerCase();
  const matchedRule =
    VOICE_RULES.find((rule) =>
      rule.keywords.some((keyword) => combinedText.includes(keyword)),
    ) ?? null;

  const selectedVoiceId = matchedRule
    ? matchedRule.preferredVoices[0]
    : DEFAULT_VOICE_ID;
  const voiceDef = MINIMAX_VOICES[selectedVoiceId];

  const emotion =
    matchedRule?.emotion ?? deriveEmotionFromContext(combinedText) ?? voiceDef.defaultEmotion;

  const speed =
    matchedRule?.speed ?? voiceDef.defaultSpeed ?? 1;

  const pitch =
    matchedRule?.pitch ?? voiceDef.defaultPitch ?? 0;

  const reasoning = matchedRule
    ? matchedRule.reasoning
    : "Defaulted to Wise Woman for balanced, authoritative narration.";

  return {
    voiceId: selectedVoiceId,
    voiceName: voiceDef.name,
    emotion,
    speed,
    pitch,
    reasoning,
  };
}

export const DEFAULT_VOICE_SELECTION: VoiceSelectionResult = selectVoiceForPrompt(
  { prompt: "" },
);
