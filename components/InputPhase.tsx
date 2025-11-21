"use client";

import { useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { PromptStep } from "./input-phase/PromptStep";
import { LoadingStep } from "./input-phase/LoadingStep";
import { QuestionsStep } from "./input-phase/QuestionsStep";
import { ReviewStep } from "./input-phase/ReviewStep";
import { useInputPhaseState } from "./input-phase/useInputPhaseState";
import type { InputPhaseProps, Question } from "./input-phase/types";

export const InputPhase = ({
  onComplete,
  projectId,
  onQuestionsGenerated,
  initialPrompt,
  initialQuestions,
}: InputPhaseProps) => {
  const state = useInputPhaseState(initialPrompt, initialQuestions);
  const {
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
  } = state;

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const allQuestionsAnswered = questions.every((q) => answers[q.id]);

  const handleAnswerQuestion = useCallback((value: string) => {
    if (!currentQuestion) return;
    
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));

    if (isLastQuestion) {
      setStep("review");
    } else {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOptionIndex(0);
      setCustomInput("");
    }
  }, [currentQuestion, isLastQuestion, setStep, setCurrentQuestionIndex, setSelectedOptionIndex, setCustomInput]);

  const handleSelectOption = useCallback(() => {
    if (!currentQuestion) return;
    
    if (selectedOptionIndex === currentQuestion.options.length) {
      // Custom input selected
      if (customInput.trim()) {
        handleAnswerQuestion(customInput.trim());
      }
    } else {
      handleAnswerQuestion(currentQuestion.options[selectedOptionIndex].value);
    }
  }, [currentQuestion, selectedOptionIndex, customInput, handleAnswerQuestion]);

  // Keyboard navigation for questions
  useEffect(() => {
    if (step !== "questions" || !currentQuestion) return;

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
  }, [step, selectedOptionIndex, currentQuestion, customInput, handleSelectOption, setSelectedOptionIndex, setCustomInput]);

  const handleSubmit = useCallback(() => {
    if (allQuestionsAnswered && prompt.trim()) {
      onComplete({
        prompt,
        responses: answers,
        projectId,
      });
    }
  }, [allQuestionsAnswered, prompt, answers, projectId, onComplete]);

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
  }, [step, allQuestionsAnswered, handleSubmit]);

  const handlePromptSubmit = async () => {
    if (!prompt.trim()) return;

    setStep("loading");
    setError(null);

    try {
      const response = await apiFetch("/api/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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


  // Render appropriate step
  if (step === "prompt") {
    return (
      <PromptStep
        prompt={prompt}
        setPrompt={setPrompt}
        onSubmit={handlePromptSubmit}
        error={error}
      />
    );
  }

  if (step === "loading") {
    return <LoadingStep />;
  }

  if (step === "questions" && currentQuestion) {
    return (
      <QuestionsStep
        questions={questions}
        currentQuestionIndex={currentQuestionIndex}
        selectedOptionIndex={selectedOptionIndex}
        setSelectedOptionIndex={setSelectedOptionIndex}
        customInput={customInput}
        setCustomInput={setCustomInput}
        customInputRef={customInputRef}
        onSelectOption={handleSelectOption}
        onAnswerQuestion={handleAnswerQuestion}
        onBack={handleBack}
      />
    );
  }

  return (
    <ReviewStep
      prompt={prompt}
      questions={questions}
      answers={answers}
      onBack={handleBack}
      onSubmit={handleSubmit}
    />
  );
};
