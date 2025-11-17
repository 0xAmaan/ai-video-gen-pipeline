/**
 * Demo Mode Mock Data
 *
 * Provides instant mock responses for all API calls in no-cost demo mode
 */

export const mockSceneGeneration = (prompt: string, sceneCount: number = 3) => {
  const scenes = [];
  for (let i = 0; i < sceneCount; i++) {
    scenes.push({
      sceneNumber: i + 1,
      description: `Demo scene ${i + 1} for: ${prompt.slice(0, 50)}...`,
      visualPrompt: `A cinematic shot showing demo content for scene ${i + 1}. This is mock data for testing purposes. The scene features dynamic composition with professional lighting and camera movement.`,
      narrationText: `This is scene ${i + 1}. Mock narration for demo purposes.`,
      duration: i === sceneCount - 1 ? 10 : 5,
      imageUrl: `https://picsum.photos/seed/${Date.now() + i}/1024/576`,
      narrationUrl: `https://www2.cs.uic.edu/~i101/SoundFiles/CantinaBand60.wav`, // Public domain audio for demo
    });
  }
  return scenes;
};

export const mockReplicatePrediction = (
  type: "image" | "video" | "lipsync",
) => {
  const predictionId = `mock-${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // Instant completion
  return {
    id: predictionId,
    status: "succeeded" as const,
    output:
      type === "image"
        ? `https://picsum.photos/seed/${Date.now()}/1024/576`
        : type === "video"
          ? `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`
          : `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4`,
    metrics: {
      predict_time: 0.1,
      total_time: 0.1,
    },
  };
};

export const mockNarrationSynthesis = () => {
  return {
    audio_url: "https://www2.cs.uic.edu/~i101/SoundFiles/CantinaBand60.wav",
    status: "success" as const,
  };
};

export const mockClarifyingQuestions = (prompt: string) => {
  return [
    {
      id: "style",
      question: "What visual style would you like?",
      options: [
        {
          label: "Cinematic",
          value: "cinematic",
          description: "Film-like quality with dramatic lighting",
        },
        {
          label: "Documentary",
          value: "documentary",
          description: "Realistic, natural appearance",
        },
        {
          label: "Animated",
          value: "animated",
          description: "Stylized, artistic rendering",
        },
      ],
    },
    {
      id: "pace",
      question: "What pacing do you prefer?",
      options: [
        {
          label: "Fast",
          value: "fast",
          description: "Quick cuts, energetic",
        },
        {
          label: "Medium",
          value: "medium",
          description: "Balanced, standard pacing",
        },
        {
          label: "Slow",
          value: "slow",
          description: "Contemplative, deliberate",
        },
      ],
    },
  ];
};

export const mockCharacterVariations = () => {
  // Return 3 distinct character images for demo mode
  return [
    {
      id: 1,
      imageUrl: `https://picsum.photos/seed/character-a-${Date.now()}/512/512`,
      seed: "character-a",
    },
    {
      id: 2,
      imageUrl: `https://picsum.photos/seed/character-b-${Date.now()}/512/512`,
      seed: "character-b",
    },
    {
      id: 3,
      imageUrl: `https://picsum.photos/seed/character-c-${Date.now()}/512/512`,
      seed: "character-c",
    },
  ];
};

export const mockVoicePreview = () => {
  return {
    audioUrl: "https://www2.cs.uic.edu/~i101/SoundFiles/CantinaBand60.wav",
    status: "success" as const,
  };
};

export const mockPollingResponse = (
  status: "processing" | "complete" | "failed" = "complete",
) => {
  if (status === "complete") {
    return {
      status: "succeeded" as const,
      videoUrl: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`,
    };
  }
  return {
    status: status === "processing" ? "processing" : "failed",
    videoUrl: null,
  };
};

export const mockLipsyncResult = () => {
  return {
    status: "succeeded" as const,
    videoUrl: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4`,
  };
};

// Simulates network delay for more realistic demo experience
export const mockDelay = (ms: number = 100) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
