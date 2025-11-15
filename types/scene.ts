// Shared Scene interface used across the application
export interface Scene {
  id: string; // Convex _id
  image: string; // imageUrl
  description: string;
  duration: number;
  sceneNumber: number; // From database, 1-indexed
}
