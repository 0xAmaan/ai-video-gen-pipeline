"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";

interface InputPhaseProps {
  onComplete: (data: {
    prompt: string;
    audience: string;
    tone: string;
    duration: string;
    style: string;
  }) => void;
}

interface Question {
  id: "audience" | "tone" | "duration" | "style";
  question: string;
  options: { label: string; value: string; description?: string }[];
}

const QUESTIONS: Question[] = [
  {
    id: "audience",
    question: "Who is your target audience?",
    options: [
      {
        label: "B2B / Business Decision Makers",
        value: "b2b",
        description: "Professional content for business audiences",
      },
      {
        label: "General Consumers",
        value: "consumers",
        description: "Broad appeal for everyday users",
      },
      {
        label: "Young Adults (18-35)",
        value: "young-adults",
        description: "Trendy, social media-focused content",
      },
      {
        label: "Enterprise / Technical",
        value: "enterprise",
        description: "In-depth technical documentation",
      },
    ],
  },
  {
    id: "tone",
    question: "What tone should the video have?",
    options: [
      {
        label: "Professional & Corporate",
        value: "professional",
        description: "Serious, trustworthy, business-focused",
      },
      {
        label: "Casual & Friendly",
        value: "casual",
        description: "Approachable, conversational, warm",
      },
      {
        label: "Energetic & Dynamic",
        value: "energetic",
        description: "High-energy, exciting, fast-paced",
      },
      {
        label: "Minimalist & Clean",
        value: "minimalist",
        description: "Simple, elegant, focused",
      },
    ],
  },
  {
    id: "duration",
    question: "How long should the video be?",
    options: [
      {
        label: "15-30 seconds",
        value: "15-30s",
        description: "Quick intro or teaser",
      },
      {
        label: "30-60 seconds",
        value: "30-60s",
        description: "Standard promotional video",
      },
      {
        label: "1-2 minutes",
        value: "1-2min",
        description: "Detailed explanation",
      },
      {
        label: "2-3 minutes",
        value: "2-3min",
        description: "In-depth walkthrough",
      },
    ],
  },
  {
    id: "style",
    question: "What visual style do you prefer?",
    options: [
      {
        label: "Cinematic & Dramatic",
        value: "cinematic",
        description: "Movie-like, high production value",
      },
      {
        label: "Bright & Colorful",
        value: "bright",
        description: "Vibrant, eye-catching, cheerful",
      },
      {
        label: "Dark & Moody",
        value: "dark",
        description: "Sophisticated, mysterious, bold",
      },
      {
        label: "Minimal & Modern",
        value: "minimal",
        description: "Clean, simple, contemporary",
      },
    ],
  },
];

type Step = "prompt" | "questions" | "review";

export const InputPhase = ({ onComplete }: InputPhaseProps) => {
  const [step, setStep] = useState<Step>("prompt");
  const [prompt, setPrompt] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [customInput, setCustomInput] = useState("");
  const customInputRef = useRef<HTMLInputElement>(null);

  const currentQuestion = QUESTIONS[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === QUESTIONS.length - 1;
  const allQuestionsAnswered = QUESTIONS.every((q) => answers[q.id]);

  // Auto-focus custom input when selected
  useEffect(() => {
    if (selectedOptionIndex === currentQuestion.options.length && customInputRef.current) {
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
          prev < currentQuestion.options.length ? prev + 1 : prev
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

  const handlePromptSubmit = () => {
    if (prompt.trim()) {
      setStep("questions");
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
      setCurrentQuestionIndex(QUESTIONS.length - 1);
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
        audience: answers.audience,
        tone: answers.tone,
        duration: answers.duration,
        style: answers.style,
      });
    }
  };

  const getAnswerLabel = (questionId: string) => {
    const question = QUESTIONS.find((q) => q.id === questionId);
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
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Press ⌘+Enter to continue
          </p>
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
              {QUESTIONS.map((_, index) => (
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
              Question {currentQuestionIndex + 1} of {QUESTIONS.length}
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
                      className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
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
                    className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedOptionIndex === currentQuestion.options.length
                        ? "border-primary bg-primary"
                        : "border-border"
                    }`}
                  >
                    {selectedOptionIndex ===
                      currentQuestion.options.length && (
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
          {QUESTIONS.map((question) => (
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
