"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface QuestionOption {
  label: string;
  value: string;
}

interface QuestionCardProps {
  question: string;
  options: QuestionOption[];
  value: string | null;
  isFocused: boolean;
  isCompleted: boolean;
  onSelect: (value: string) => void;
  onFocus: () => void;
}

export const QuestionCard = ({
  question,
  options,
  value,
  isFocused,
  isCompleted,
  onSelect,
  onFocus,
}: QuestionCardProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCustomInput, setIsCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when this card becomes focused
  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.focus();
    }
  }, [isFocused]);

  // Focus custom input when activated
  useEffect(() => {
    if (isCustomInput && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [isCustomInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isFocused) return;

    // If in custom input mode, let the input handle most keys
    if (isCustomInput) {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsCustomInput(false);
        setCustomValue("");
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (customValue.trim()) {
          onSelect(customValue.trim());
          setIsCustomInput(false);
        }
      }
      return;
    }

    // Navigation keys
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < options.length ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex === options.length) {
          // "Other" option selected
          setIsCustomInput(true);
        } else {
          onSelect(options[selectedIndex].value);
        }
        break;
      case "Tab":
        // Let default tab behavior work
        break;
    }
  };

  const handleOptionClick = (index: number) => {
    if (!isFocused) {
      onFocus();
    }
    setSelectedIndex(index);
    if (index === options.length) {
      setIsCustomInput(true);
    } else {
      onSelect(options[index].value);
    }
  };

  return (
    <Card
      ref={cardRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={onFocus}
      className={`p-6 transition-all cursor-pointer ${
        isFocused
          ? "ring-2 ring-primary border-primary"
          : isCompleted
            ? "border-primary/50"
            : "border-border"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-medium">{question}</h3>
        {isCompleted && (
          <Badge variant="default" className="bg-primary">
            <Check className="w-3 h-3 mr-1" />
            Done
          </Badge>
        )}
      </div>

      {/* Options */}
      <div className="space-y-2">
        {options.map((option, index) => (
          <div
            key={option.value}
            onClick={() => handleOptionClick(index)}
            className={`p-3 rounded-lg border transition-all cursor-pointer ${
              value === option.value
                ? "bg-primary/10 border-primary"
                : isFocused && selectedIndex === index
                  ? "bg-accent border-accent-foreground/20"
                  : "bg-card border-border hover:bg-accent/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  value === option.value
                    ? "border-primary bg-primary"
                    : "border-border"
                }`}
              >
                {value === option.value && (
                  <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                )}
              </div>
              <span className="text-sm">{option.label}</span>
            </div>
          </div>
        ))}

        {/* Other/Custom Input Option */}
        <div
          onClick={() => handleOptionClick(options.length)}
          className={`p-3 rounded-lg border transition-all cursor-pointer ${
            isFocused && selectedIndex === options.length
              ? "bg-accent border-accent-foreground/20"
              : "bg-card border-border hover:bg-accent/50"
          }`}
        >
          {isCustomInput ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Other (press Enter to confirm, Esc to cancel)</span>
              </div>
              <Input
                ref={customInputRef}
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder="Type your answer..."
                className="mt-2"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-border" />
              <span className="text-sm">Other (type your own)</span>
            </div>
          )}
        </div>
      </div>

      {/* Help text */}
      {isFocused && !isCustomInput && (
        <div className="mt-4 text-xs text-muted-foreground">
          Use ↑↓ arrows to navigate • Enter to select • Tab to next question
        </div>
      )}
    </Card>
  );
};
