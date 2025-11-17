export interface Question {
  id: string;
  question: string;
  options: { label: string; value: string; description: string }[];
}

export type Step = "prompt" | "loading" | "questions" | "review";

export interface InputPhaseProps {
  onComplete: (data: {
    prompt: string;
    responses: Record<string, string>;
    projectId?: string;
  }) => void;
  projectId?: string;
  onQuestionsGenerated?: (
    prompt: string,
    questions: Question[],
  ) => Promise<string | null>;
  initialPrompt?: string;
  initialQuestions?: Question[];
}

