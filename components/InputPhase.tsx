"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";

interface InputPhaseProps {
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

interface Question {
  id: string;
  question: string;
  options: { label: string; value: string; description: string }[];
}

type Step = "prompt" | "loading" | "questions" | "review";

export const InputPhase = ({
  onComplete,
  projectId,
  onQuestionsGenerated,
  initialPrompt,
  initialQuestions,
}: InputPhaseProps) => {
  const [step, setStep] = useState<Step>(
    initialQuestions ? "questions" : "prompt",
  );
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [questions, setQuestions] = useState<Question[]>(
    initialQuestions || [],
  );
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // Update state when initial values change
  useEffect(() => {
    if (initialPrompt && !prompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    if (initialQuestions && questions.length === 0) {
      setQuestions(initialQuestions);
      setStep("questions");
    }
  }, [initialQuestions]);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const allQuestionsAnswered = questions.every((q) => answers[q.id]);

  // Auto-focus custom input when selected
  useEffect(() => {
    if (
      currentQuestion &&
      selectedOptionIndex === currentQuestion.options.length &&
      customInputRef.current
    ) {
      customInputRef.current.focus();
    }
  }, [selectedOptionIndex, currentQuestion]);

  // Keyboard navigation for questions
  useEffect(() => {
    if (step !== "questions") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedOptionIndex((prev) =>
          prev < currentQuestion.options.length ? prev + 1 : prev,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedOptionIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSelectOption();
      } else if (e.key === "Escape" && customInput !== "") {
        e.preventDefault();
        setCustomInput("");
        setSelectedOptionIndex(0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, selectedOptionIndex, currentQuestion, customInput]);

  // Keyboard shortcut for review page
  useEffect(() => {
    if (step !== "review") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.metaKey && allQuestionsAnswered) {
        handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, allQuestionsAnswered]);

  const handlePromptSubmit = async () => {
    if (!prompt.trim()) return;

    setStep("loading");
    setError(null);

    try {
      const response = await fetch("/api/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate questions");
      }

      const data = await response.json();
      setQuestions(data.questions);

      // Call the callback to save project and questions to Convex
      if (onQuestionsGenerated) {
        await onQuestionsGenerated(prompt.trim(), data.questions);
      }

      setStep("questions");
    } catch (err) {
      console.error("Error generating questions:", err);
      setError("Failed to generate questions. Please try again.");
      setStep("prompt");
    }
  };

  const handleSelectOption = () => {
    if (selectedOptionIndex === currentQuestion.options.length) {
      // Custom input selected
      if (customInput.trim()) {
        handleAnswerQuestion(customInput.trim());
      }
    } else {
      handleAnswerQuestion(currentQuestion.options[selectedOptionIndex].value);
    }
  };

  const handleAnswerQuestion = (value: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));

    if (isLastQuestion) {
      setStep("review");
    } else {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOptionIndex(0);
      setCustomInput("");
    }
  };

  const handleBack = () => {
    if (step === "review") {
      setStep("questions");
      setCurrentQuestionIndex(questions.length - 1);
    } else if (step === "questions") {
      if (currentQuestionIndex > 0) {
        setCurrentQuestionIndex((prev) => prev - 1);
        setSelectedOptionIndex(0);
      } else {
        setStep("prompt");
      }
    }
  };

  const handleSubmit = () => {
    if (allQuestionsAnswered && prompt.trim()) {
      onComplete({
        prompt,
        responses: answers,
        projectId,
      });
    }
  };

  const getAnswerLabel = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    const answer = answers[questionId];
    const option = question?.options.find((o) => o.value === answer);
    return option?.label || answer;
  };

  // PROMPT STEP
  if (step === "prompt") {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="w-full max-w-3xl px-4">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-3">Create Your Video</h1>
            <p className="text-lg text-muted-foreground">
              Start by describing what you want to create
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-8 shadow-xl shadow-black/40">
            <label
              htmlFor="prompt"
              className="block text-xl font-semibold mb-4 text-center"
            >
              What video would you like to create?
            </label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: A product demo video showcasing our new mobile app's key features like real-time collaboration and smart notifications..."
              className="min-h-[160px] text-base resize-none bg-input border-border/60 p-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey && prompt.trim()) {
                  handlePromptSubmit();
                }
              }}
            />
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Be specific about key points, features, or messages you want to
                convey
              </p>
              <Button
                onClick={handlePromptSubmit}
                disabled={!prompt.trim()}
                size="lg"
                className="bg-primary hover:bg-primary/90"
              >
                Continue
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive mt-3 text-center">
                {error}
              </p>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Press ⌘+Enter to continue
          </p>
        </div>
      </div>
    );
  }

  // LOADING STEP
  if (step === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="w-full max-w-3xl px-4 text-center">
          <div className="bg-card border border-border rounded-xl p-12 shadow-xl shadow-black/40">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <h2 className="text-2xl font-semibold">
                Generating Clarifying Questions...
              </h2>
              <p className="text-muted-foreground">
                Our AI is analyzing your prompt to create personalized questions
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // QUESTIONS STEP
  if (step === "questions") {
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
                    handleAnswerQuestion(option.value);
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
                          handleAnswerQuestion(customInput.trim());
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
              onClick={handleBack}
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
  }

  // REVIEW STEP
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
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="mr-2 w-4 h-4" />
              Edit Answers
            </Button>
            <Button
              onClick={handleSubmit}
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
