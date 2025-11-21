/**
 * Mock data and utilities for music-related demo mode
 */

export const mockDelay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const mockMusicTrack = (prompt: string, duration?: number) => {
  const actualDuration = duration || 30;
  return {
    audioUrl: `https://example.com/mock-music-${Math.random().toString(36).slice(2)}.mp3`,
    durationSeconds: actualDuration,
    format: "mp3",
    prompt: prompt.trim(),
    mood: "upbeat",
    tempo: "medium",
  };
};

export const mockAudioSearchResults = (
  query: string,
  page?: number,
  perPage?: number,
) => {
  const currentPage = page || 1;
  const pageSize = perPage || 10;
  const total = 50; // Mock total results

  const results = Array.from({ length: Math.min(pageSize, 10) }, (_, i) => ({
    id: `mock-audio-${currentPage}-${i}`,
    name: `${query} ${i + 1}`,
    description: `Mock audio result for "${query}"`,
    url: `https://example.com/mock-audio-${currentPage}-${i}.mp3`,
    previewUrl: `https://example.com/mock-audio-${currentPage}-${i}-preview.mp3`,
    durationSeconds: Math.floor(Math.random() * 120) + 10,
    tags: ["mock", query.toLowerCase(), "audio"],
    license: "CC0",
    username: "MockUser",
  }));

  return {
    results,
    page: currentPage,
    perPage: pageSize,
    total,
    hasMore: currentPage * pageSize < total,
  };
};

export const mockElevenLabsVoice = (text: string, voiceId?: string) => {
  const duration = Math.ceil(text.length / 15); // Rough estimate: 15 chars/sec
  return {
    audioUrl: `https://example.com/mock-elevenlabs-${Math.random().toString(36).slice(2)}.mp3`,
    durationSeconds: duration,
    format: "mp3",
    voiceId: voiceId || "mock-voice-id",
    voiceName: "Mock Voice",
  };
};

export const mockElevenLabsVoices = () => [
  {
    id: "mock-voice-1",
    name: "Adam",
    previewUrl: "https://example.com/preview-adam.mp3",
    labels: { accent: "american", description: "deep", age: "middle_aged" },
  },
  {
    id: "mock-voice-2",
    name: "Alice",
    previewUrl: "https://example.com/preview-alice.mp3",
    labels: { accent: "british", description: "confident", age: "young" },
  },
  {
    id: "mock-voice-3",
    name: "Charlie",
    previewUrl: "https://example.com/preview-charlie.mp3",
    labels: { accent: "american", description: "casual", age: "young" },
  },
  {
    id: "mock-voice-4",
    name: "Dorothy",
    previewUrl: "https://example.com/preview-dorothy.mp3",
    labels: { accent: "british", description: "pleasant", age: "middle_aged" },
  },
  {
    id: "mock-voice-5",
    name: "Ethan",
    previewUrl: "https://example.com/preview-ethan.mp3",
    labels: { accent: "american", description: "narrator", age: "middle_aged" },
  },
];
