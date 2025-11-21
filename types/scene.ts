export type LipsyncStatus = "pending" | "processing" | "complete" | "failed";

// Shared Scene interface used across the application
export interface Scene {
  id: string; // Convex _id
  image: string; // imageUrl
  description: string; // Short narrative description for UI display
  visualPrompt?: string; // Detailed 150-250 word prompt for video generation (optional for backwards compatibility)
  duration: number;
  sceneNumber: number; // From database, 1-indexed
  narrationUrl?: string;
  narrationText?: string;
  voiceId?: string;
  voiceName?: string;
  lipsyncVideoUrl?: string;
  lipsyncStatus?: LipsyncStatus;
  lipsyncPredictionId?: string;
  backgroundMusicUrl?: string;
  backgroundMusicSource?: "generated" | "freesound" | "uploaded";
  backgroundMusicPrompt?: string;
  backgroundMusicMood?: string;
}
