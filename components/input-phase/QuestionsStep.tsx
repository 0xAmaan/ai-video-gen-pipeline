import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { Question } from "./types";

interface QuestionsStepProps {
  questions: Question[];
  currentQuestionIndex: number;
  selectedOptionIndex: number;
  setSelectedOptionIndex: (index: number) => void;
  customInput: string;
  setCustomInput: (value: string) => void;
  customInputRef: React.RefObject<HTMLInputElement | null>;
  onSelectOption: () => void;
  onAnswerQuestion: (value: string) => void;
  onBack: () => void;
}

export const QuestionsStep = ({
  questions,
  currentQuestionIndex,
  selectedOptionIndex,
  setSelectedOptionIndex,
  customInput,
  setCustomInput,
  customInputRef,
  onSelectOption,
  onAnswerQuestion,
  onBack,
}: QuestionsStepProps) => {
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="w-full max-w-3xl px-4">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            {questions.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  index < currentQuestionIndex
                    ? "bg-primary"
                    : index === currentQuestionIndex
                      ? "bg-primary/50"
                      : "bg-border"
                }`}
              />
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Question {currentQuestionIndex + 1} of {questions.length}
          </p>
        </div>

        {/* Question */}
        <div className="bg-card border border-border rounded-xl p-8 shadow-lg">
          <h2 className="text-2xl font-semibold mb-6">
            {currentQuestion.question}
          </h2>

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <button
                key={option.value}
                onClick={() => {
                  setSelectedOptionIndex(index);
                  onAnswerQuestion(option.value);
                }}
                onMouseEnter={() => setSelectedOptionIndex(index)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedOptionIndex === index
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      selectedOptionIndex === index
                        ? "border-primary bg-primary"
                        : "border-border"
                    }`}
                  >
                    {selectedOptionIndex === index && (
                      <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium mb-1">{option.label}</div>
                    {option.description && (
                      <div className="text-sm text-muted-foreground">
                        {option.description}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {/* Custom input option */}
            <div
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedOptionIndex === currentQuestion.options.length
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    selectedOptionIndex === currentQuestion.options.length
                      ? "border-primary bg-primary"
                      : "border-border"
                  }`}
                >
                  {selectedOptionIndex === currentQuestion.options.length && (
                    <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    ref={customInputRef}
                    type="text"
                    value={customInput}
                    onChange={(e) => {
                      setCustomInput(e.target.value);
                      setSelectedOptionIndex(currentQuestion.options.length);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customInput.trim()) {
                        onAnswerQuestion(customInput.trim());
                      }
                    }}
                    placeholder="Type your own answer..."
                    className="w-full bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation hints */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-muted-foreground"
          >
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back
          </Button>
          <p className="text-sm text-muted-foreground">
            Enter to select • ↑↓ to navigate • Esc to cancel
          </p>
        </div>
      </div>
    </div>
  );
};

