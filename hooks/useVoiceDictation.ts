import { useState, useEffect, useCallback, useRef } from "react";

interface UseVoiceDictationOptions {
  onTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  existingText?: string; // Text to preserve when starting dictation
}

interface UseVoiceDictationReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
  error: string | null;
}

export const useVoiceDictation = (
  options: UseVoiceDictationOptions = {}
): UseVoiceDictationReturn => {
  const {
    onTranscript,
    onError,
    continuous = true,
    interimResults = true,
    lang = "en-US",
    existingText = "",
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const existingTextRef = useRef(""); // Store text that existed before dictation started

  // Check for browser support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);

      if (SpeechRecognition && !recognitionRef.current) {
        const recognition = new SpeechRecognition();
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.lang = lang;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = "";
          let finalTranscript = finalTranscriptRef.current;

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptPiece = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcriptPiece + " ";
            } else {
              interimTranscript += transcriptPiece;
            }
          }

          finalTranscriptRef.current = finalTranscript;
          // Prepend existing text to the new speech
          const newSpeech = finalTranscript + interimTranscript;
          const fullTranscript = existingTextRef.current 
            ? existingTextRef.current + (existingTextRef.current.endsWith(' ') ? '' : ' ') + newSpeech
            : newSpeech;
          setTranscript(fullTranscript);

          if (onTranscript) {
            onTranscript(fullTranscript);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          let errorMessage = "Voice recognition error occurred";

          switch (event.error) {
            case "no-speech":
              errorMessage = "No speech detected. Please try again.";
              break;
            case "audio-capture":
              errorMessage = "No microphone found. Please check your settings.";
              break;
            case "not-allowed":
              errorMessage = "Microphone access denied. Please allow access.";
              break;
            case "network":
              errorMessage = "Network error occurred.";
              break;
            default:
              errorMessage = `Error: ${event.error}`;
          }

          setError(errorMessage);
          setIsListening(false);

          if (onError) {
            onError(errorMessage);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [continuous, interimResults, lang, onTranscript, onError]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      const errorMsg = "Speech recognition is not supported in this browser.";
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
      return;
    }

    if (recognitionRef.current && !isListening) {
      try {
        // Store existing text to preserve it
        existingTextRef.current = existingText;
        // Only reset the new speech part, not existing text
        finalTranscriptRef.current = "";
        setTranscript(existingText); // Start with existing text
        setError(null);
        recognitionRef.current.start();
      } catch (err) {
        console.error("Error starting recognition:", err);
        setError("Failed to start voice recognition");
      }
    }
  }, [isSupported, isListening, onError, existingText]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    finalTranscriptRef.current = "";
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    error,
  };
};

// Type definitions for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror:
      | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any)
      | null;
    onresult:
      | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
      | null;
  }

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error:
      | "no-speech"
      | "aborted"
      | "audio-capture"
      | "network"
      | "not-allowed"
      | "service-not-allowed"
      | "bad-grammar"
      | "language-not-supported";
    message?: string;
  }

  const SpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };
}
