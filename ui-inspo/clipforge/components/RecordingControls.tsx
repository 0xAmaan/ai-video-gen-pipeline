import React, { useEffect, useState } from "react";
import { formatTime } from "../utils/timeFormat";

export interface RecordingControlsProps {
  isRecording: boolean;
  isPicking: boolean;
  isSaving?: boolean;
  elapsedTime: number;
  onStartPicking: () => void;
  onStopRecording: () => void;
  error: string | null;
  onOpenSettings?: () => void;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({
  isRecording,
  isPicking,
  isSaving,
  elapsedTime,
  onStartPicking,
  onStopRecording,
  error,
  onOpenSettings,
}) => {
  const [displayTime, setDisplayTime] = useState("00:00");

  useEffect(() => {
    setDisplayTime(formatTime(elapsedTime));
  }, [elapsedTime]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Screen Recording</h3>
        {isRecording && (
          <div style={styles.recordingIndicator}>
            <span style={styles.recordingDot}></span>
            <span style={styles.recordingText}>Recording</span>
          </div>
        )}
        {isSaving && (
          <div style={styles.savingIndicator}>
            <span style={styles.savingSpinner}></span>
            <span style={styles.savingText}>Saving...</span>
          </div>
        )}
      </div>

      {error && (
        <div style={styles.errorContainer}>
          <div style={styles.error}>
            {/* Display error message with preserved line breaks */}
            <div style={styles.errorMessage}>
              {error.split('\n').map((line, index) => (
                <React.Fragment key={index}>
                  {line}
                  {index < error.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>

            {/* Show "Open System Settings" button for permission errors */}
            {error.includes("permission") && onOpenSettings && (
              <button
                style={styles.settingsButton}
                onClick={onOpenSettings}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#2563eb";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "#3b82f6";
                }}
              >
                Open System Settings
              </button>
            )}
          </div>
        </div>
      )}

      <div style={styles.controls}>
        {!isRecording && !isSaving ? (
          <button
            style={{
              ...styles.button,
              ...styles.primaryButton,
            }}
            onClick={onStartPicking}
            disabled={isPicking}
            onMouseEnter={(e) => {
              if (!isPicking) {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "#2563eb";
              }
            }}
            onMouseLeave={(e) => {
              if (!isPicking) {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "#3b82f6";
              }
            }}
          >
            {isPicking ? "Starting..." : "Start Recording"}
          </button>
        ) : isSaving ? (
          <div style={styles.savingMessage}>
            <span style={styles.savingSpinner}></span>
            Processing and importing video...
          </div>
        ) : (
          <div style={styles.recordingControls}>
            <div style={styles.timer}>{displayTime}</div>
            <button
              style={{
                ...styles.button,
                ...styles.stopButton,
              }}
              onClick={onStopRecording}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "#dc2626";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "#ef4444";
              }}
            >
              Stop Recording
            </button>
          </div>
        )}
      </div>

      {!isRecording && !isPicking && !isSaving && (
        <div style={styles.hint}>
          Click "Start Recording" to select a screen or window to capture
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    backgroundColor: "#1a1a1a",
    borderRadius: "8px",
    border: "1px solid #333",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    margin: 0,
    fontSize: "16px",
    fontWeight: "600",
    color: "#fff",
  },
  recordingIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  recordingDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: "#ef4444",
    animation: "pulse 1.5s ease-in-out infinite",
  },
  recordingText: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#ef4444",
  },
  savingIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  savingSpinner: {
    width: "12px",
    height: "12px",
    border: "2px solid #3b82f6",
    borderTopColor: "transparent",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  savingText: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#3b82f6",
  },
  savingMessage: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    color: "#3b82f6",
    fontSize: "14px",
    fontWeight: "600",
  },
  errorContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  error: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid #ef4444",
    borderRadius: "6px",
    color: "#ef4444",
    fontSize: "14px",
    lineHeight: "1.6",
  },
  errorMessage: {
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  link: {
    color: "#3b82f6",
    textDecoration: "underline",
    cursor: "pointer",
    fontWeight: "600",
  },
  settingsButton: {
    padding: "10px 20px",
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    transition: "all 0.2s",
    alignSelf: "flex-start",
    marginTop: "4px",
  },
  controls: {
    display: "flex",
    gap: "12px",
  },
  button: {
    padding: "12px 24px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "600",
    transition: "all 0.2s",
  },
  primaryButton: {
    backgroundColor: "#3b82f6",
    color: "white",
  },
  recordingControls: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    width: "100%",
  },
  timer: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#fff",
    fontVariantNumeric: "tabular-nums",
    minWidth: "80px",
  },
  stopButton: {
    backgroundColor: "#ef4444",
    color: "white",
  },
  hint: {
    fontSize: "14px",
    color: "#888",
    fontStyle: "italic",
  },
};

// Add CSS animations for the recording dot pulse and saving spinner
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default RecordingControls;
