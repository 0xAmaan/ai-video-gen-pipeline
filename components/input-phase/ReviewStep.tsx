import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import type { Question } from "./types";

interface ReviewStepProps {
  prompt: string;
  questions: Question[];
  answers: Record<string, string>;
  onBack: () => void;
  onSubmit: () => void;
}

export const ReviewStep = ({
  prompt,
  questions,
  answers,
  onBack,
  onSubmit,
}: ReviewStepProps) => {
  const getAnswerLabel = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    const answer = answers[questionId];
    const option = question?.options.find((o) => o.value === answer);
    return option?.label || answer;
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="w-full max-w-3xl px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Review Your Answers</h1>
          <p className="text-muted-foreground">
            Make sure everything looks good before continuing
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-8 shadow-xl shadow-black/40 space-y-6">
          {/* Prompt */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Video Description
              </h3>
            </div>
            <p className="text-base pl-6">{prompt}</p>
          </div>

          {/* Answers */}
          {questions.map((question) => (
            <div key={question.id}>
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  {question.question}
                </h3>
              </div>
              <p className="text-base pl-6 text-primary">
                {getAnswerLabel(question.id)}
              </p>
            </div>
          ))}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="mr-2 w-4 h-4" />
              Edit Answers
            </Button>
            <Button
              onClick={onSubmit}
              size="lg"
              className="bg-primary hover:bg-primary/90"
            >
              Continue to Storyboard
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Press ⌘+Enter to continue
        </p>
      </div>
    </div>
  );
};

