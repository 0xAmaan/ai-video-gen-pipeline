import { useState, useEffect, useRef } from "react";
import type { Question, Step } from "./types";

export function useInputPhaseState(
  initialPrompt?: string,
  initialQuestions?: Question[],
) {
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
  }, [initialPrompt, prompt]);

  useEffect(() => {
    if (initialQuestions && questions.length === 0) {
      setQuestions(initialQuestions);
      setStep("questions");
    }
  }, [initialQuestions, questions.length]);

  // Auto-focus custom input when selected
  useEffect(() => {
    if (
      questions[currentQuestionIndex] &&
      selectedOptionIndex === questions[currentQuestionIndex].options.length &&
      customInputRef.current
    ) {
      customInputRef.current.focus();
    }
  }, [selectedOptionIndex, currentQuestionIndex, questions]);

  return {
    step,
    setStep,
    prompt,
    setPrompt,
    questions,
    setQuestions,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answers,
    setAnswers,
    selectedOptionIndex,
    setSelectedOptionIndex,
    customInput,
    setCustomInput,
    error,
    setError,
    customInputRef,
  };
}

