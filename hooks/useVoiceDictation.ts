import { useState, useEffect, useCallback, useRef } from "react";

type SpeechRecognition = any;
type SpeechRecognitionEvent = any;
type SpeechRecognitionErrorEvent = any;

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
  options: UseVoiceDictationOptions = {},
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
  const startTimeRef = useRef<number>(0); // Track when recognition started
  const retryCountRef = useRef(0); // Track retry attempts
  const autoRestartRef = useRef(false); // Flag to prevent manual stop from restarting

  // Detect Brave browser
  const isBrave = useCallback(() => {
    return (
      typeof window !== "undefined" &&
      // @ts-ignore - Brave-specific API
      navigator.brave &&
      typeof navigator.brave.isBrave === "function"
    );
  }, []);

  // Check for browser support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);

      // Log browser info for debugging
      if (isBrave()) {
        console.log(
          "[VoiceDictation] Brave browser detected - speech recognition may require Shields to be disabled",
        );
      }

      if (SpeechRecognition && !recognitionRef.current) {
        const recognition = new SpeechRecognition();
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.lang = lang;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          startTimeRef.current = Date.now();
          console.log("[VoiceDictation] Recognition started");
          setIsListening(true);
          setError(null);
        };

        recognition.onaudiostart = () => {
          console.log("[VoiceDictation] Audio capture started");
        };

        recognition.onaudioend = () => {
          const duration = Date.now() - startTimeRef.current;
          console.log(
            `[VoiceDictation] Audio capture ended (duration: ${duration}ms)`,
          );
        };

        recognition.onspeechstart = () => {
          console.log("[VoiceDictation] Speech detected");
        };

        recognition.onspeechend = () => {
          console.log("[VoiceDictation] Speech ended");
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
            ? existingTextRef.current +
              (existingTextRef.current.endsWith(" ") ? "" : " ") +
              newSpeech
            : newSpeech;
          setTranscript(fullTranscript);

          if (onTranscript) {
            onTranscript(fullTranscript);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          const duration = Date.now() - startTimeRef.current;
          console.error(
            `[VoiceDictation] Error: ${event.error} (duration: ${duration}ms)`,
            event,
          );

          let errorMessage = "Voice recognition error occurred";

          switch (event.error) {
            case "no-speech":
              errorMessage = "No speech detected. Please try again.";
              break;
            case "audio-capture":
              errorMessage = isBrave()
                ? "Microphone blocked. Try disabling Brave Shields for this site."
                : "No microphone found. Please check your settings.";
              break;
            case "not-allowed":
              errorMessage = isBrave()
                ? "Microphone access denied. Check Brave Settings > Privacy and security > Site settings > Microphone."
                : "Microphone access denied. Please allow access.";
              break;
            case "network":
              errorMessage = isBrave()
                ? "⚠️ Brave Shields is blocking speech recognition. Click the shield icon in your address bar and turn Shields OFF for this site, then try again."
                : "Network error occurred.";
              console.warn(
                "[VoiceDictation] Network error - if using Brave, disable Shields by clicking the shield icon in the address bar",
              );
              break;
            case "aborted":
              errorMessage = isBrave()
                ? "Speech recognition was aborted. This often happens with Brave Shields enabled."
                : "Speech recognition was aborted.";
              break;
            default:
              errorMessage = isBrave()
                ? `Error: ${event.error}. Try disabling Brave Shields for this site.`
                : `Error: ${event.error}`;
          }

          setError(errorMessage);
          setIsListening(false);
          autoRestartRef.current = false; // Don't auto-restart on error

          if (onError) {
            onError(errorMessage);
          }
        };

        recognition.onend = () => {
          const duration = Date.now() - startTimeRef.current;
          console.log(
            `[VoiceDictation] Recognition ended (duration: ${duration}ms, retries: ${retryCountRef.current})`,
          );

          // Auto-restart if ended prematurely (within 3 seconds) and we haven't tried too many times
          // This helps with Brave's tendency to immediately close recognition
          if (
            autoRestartRef.current &&
            duration < 3000 &&
            retryCountRef.current < 3
          ) {
            console.log(
              `[VoiceDictation] Premature end detected (${duration}ms), auto-restarting...`,
            );
            retryCountRef.current++;

            setTimeout(() => {
              if (recognitionRef.current && autoRestartRef.current) {
                try {
                  recognitionRef.current.start();
                } catch (err) {
                  console.error("[VoiceDictation] Auto-restart failed:", err);
                  setIsListening(false);
                  autoRestartRef.current = false;
                }
              }
            }, 200); // Small delay before restart
          } else {
            setIsListening(false);
            autoRestartRef.current = false;
            retryCountRef.current = 0;

            // Show Brave-specific guidance if we hit retry limit
            if (retryCountRef.current >= 3 && isBrave()) {
              const braveMsg =
                "Speech recognition keeps stopping. Try disabling Brave Shields for this site (click the shield icon in the address bar).";
              setError(braveMsg);
              if (onError) {
                onError(braveMsg);
              }
            }
          }
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
        autoRestartRef.current = true; // Enable auto-restart for this session
        retryCountRef.current = 0; // Reset retry counter
        recognitionRef.current.start();
      } catch (err) {
        console.error("Error starting recognition:", err);
        setError("Failed to start voice recognition");
      }
    }
  }, [isSupported, isListening, onError, existingText]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      autoRestartRef.current = false; // Disable auto-restart when manually stopping
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

// Minimal ambient declarations for Web Speech API (browser-provided)
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
