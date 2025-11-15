import React from "react";
import { ScreenSource } from "../types";

export interface SourcePickerProps {
  sources: ScreenSource[];
  onSelect: (source: ScreenSource) => void;
  onCancel: () => void;
}

const SourcePicker: React.FC<SourcePickerProps> = ({
  sources,
  onSelect,
  onCancel,
}) => {
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>Select Screen or Window</h2>
          <button style={styles.closeButton} onClick={onCancel}>
            ✕
          </button>
        </div>

        <div style={styles.grid}>
          {sources.map((source) => (
            <div
              key={source.id}
              style={styles.sourceCard}
              onClick={() => onSelect(source)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#3b82f6";
                (e.currentTarget as HTMLElement).style.transform =
                  "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#333";
                (e.currentTarget as HTMLElement).style.transform =
                  "translateY(0)";
              }}
            >
              <img
                src={source.thumbnail}
                alt={source.name}
                style={styles.thumbnail}
              />
              <div style={styles.sourceInfo}>
                <span
                  style={{
                    ...styles.badge,
                    ...(source.type === "screen"
                      ? styles.screenBadge
                      : styles.windowBadge),
                  }}
                >
                  {source.type === "screen" ? "Screen" : "Window"}
                </span>
                <span style={styles.sourceName}>{source.name}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#1a1a1a",
    borderRadius: "12px",
    border: "1px solid #333",
    maxWidth: "800px",
    maxHeight: "80vh",
    width: "90%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #333",
  },
  title: {
    margin: 0,
    fontSize: "20px",
    fontWeight: "600",
    color: "#fff",
  },
  closeButton: {
    background: "none",
    border: "none",
    color: "#888",
    fontSize: "24px",
    cursor: "pointer",
    padding: "0",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "4px",
    transition: "all 0.2s",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "16px",
    padding: "24px",
    overflowY: "auto",
    maxHeight: "calc(80vh - 160px)",
  },
  sourceCard: {
    backgroundColor: "#0a0a0a",
    border: "2px solid #333",
    borderRadius: "8px",
    padding: "12px",
    cursor: "pointer",
    transition: "all 0.2s",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  thumbnail: {
    width: "100%",
    height: "auto",
    borderRadius: "4px",
    backgroundColor: "#000",
  },
  sourceInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  badge: {
    fontSize: "11px",
    fontWeight: "600",
    padding: "4px 8px",
    borderRadius: "4px",
    width: "fit-content",
    textTransform: "uppercase",
  },
  screenBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    color: "#3b82f6",
  },
  windowBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    color: "#10b981",
  },
  sourceName: {
    fontSize: "14px",
    color: "#fff",
    fontWeight: "500",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  footer: {
    padding: "16px 24px",
    borderTop: "1px solid #333",
    display: "flex",
    justifyContent: "flex-end",
  },
  cancelButton: {
    padding: "10px 20px",
    backgroundColor: "#333",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    transition: "all 0.2s",
  },
};

export default SourcePicker;
