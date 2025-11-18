export interface StoryboardPart {
  id: string;
  partNumber: number;
  image: string;
  prompt: string;
  color?: "green" | "red" | "blue" | "amber";
}

export interface StoryboardScene {
  id: string;
  sceneNumber: number;
  title: string;
  parts: StoryboardPart[];
  isSelected?: boolean;
}

// Mock data generator
export const generateMockStoryboard = (): StoryboardScene[] => {
  return [
    {
      id: "scene-1",
      sceneNumber: 1,
      title: "Scene 1",
      parts: [
        {
          id: "part-1-1",
          partNumber: 1,
          image: "https://picsum.photos/seed/s1p1/400/300",
          prompt: "Wide shot of an office environment",
          color: "green",
        },
        {
          id: "part-1-2",
          partNumber: 2,
          image: "https://picsum.photos/seed/s1p2/400/300",
          prompt: "Medium shot focusing on character",
          color: "amber",
        },
        {
          id: "part-1-3",
          partNumber: 3,
          image: "https://picsum.photos/seed/s1p3/400/300",
          prompt: "Close-up of character's face",
          color: "blue",
        },
      ],
      isSelected: true, // First scene selected by default
    },
    {
      id: "scene-2",
      sceneNumber: 2,
      title: "Scene 2",
      parts: [
        {
          id: "part-2-1",
          partNumber: 1,
          image: "https://picsum.photos/seed/s2p1/400/300",
          prompt: "Establishing shot of new location",
          color: "green",
        },
        {
          id: "part-2-2",
          partNumber: 2,
          image: "https://picsum.photos/seed/s2p2/400/300",
          prompt: "Action sequence begins",
          color: "red",
        },
        {
          id: "part-2-3",
          partNumber: 3,
          image: "https://picsum.photos/seed/s2p3/400/300",
          prompt: "Character reaction shot",
          color: "amber",
        },
      ],
      isSelected: false,
    },
    {
      id: "scene-3",
      sceneNumber: 3,
      title: "Scene 3",
      parts: [
        {
          id: "part-3-1",
          partNumber: 1,
          image: "https://picsum.photos/seed/s3p1/400/300",
          prompt: "Outdoor environment establishing shot",
          color: "green",
        },
        {
          id: "part-3-2",
          partNumber: 2,
          image: "https://picsum.photos/seed/s3p2/400/300",
          prompt: "Character walking through environment",
          color: "blue",
        },
      ],
      isSelected: false,
    },
  ];
};
