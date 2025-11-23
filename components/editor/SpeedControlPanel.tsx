"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Card } from "../ui/card";
import { Slider } from "../ui/slider";
import type { SpeedCurve, SpeedKeyframe } from "@/lib/editor/types";
import { calculateSpeedAtTime } from "@/lib/editor/effects/speed-interpolation";
import {
  SPEED_PRESETS,
  generatePresetThumbnail,
} from "@/lib/editor/effects/speed-presets";
import {
  Gauge,
  Zap,
  TrendingUp,
  TrendingDown,
  Pause,
  RotateCcw,
  Activity,
  Film,
} from "lucide-react";

interface SpeedControlPanelProps {
  speedCurve: SpeedCurve | null;
  clipDuration: number;
  currentTime: number; // Current playhead position within clip (0 to clipDuration)
  onSpeedCurveChange: (curve: SpeedCurve | null) => void;
}

// Category icons for preset organization
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ramps: TrendingUp,
  effects: Zap,
  custom: Activity,
};

export const SpeedControlPanel = ({
  speedCurve,
  clipDuration,
  currentTime,
  onSpeedCurveChange,
}: SpeedControlPanelProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredKeyframe, setHoveredKeyframe] = useState<number | null>(null);
  const [draggingKeyframe, setDraggingKeyframe] = useState<number | null>(null);
  const [previewPreset, setPreviewPreset] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<"ramps" | "effects" | "all">("all");

  // Current speed at playhead position
  const normalizedTime = clipDuration > 0 ? currentTime / clipDuration : 0;
  const currentSpeed = calculateSpeedAtTime(speedCurve, normalizedTime);

  // Filter presets by category
  const filteredPresets = selectedCategory === "all"
    ? SPEED_PRESETS
    : SPEED_PRESETS.filter((p) => p.category === selectedCategory);

  // Draw the curve visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.isConnected) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect || rect.width === undefined) return;
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = 20;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = "rgba(128, 128, 128, 0.2)";
    ctx.lineWidth = 1;

    // Vertical lines (time)
    for (let i = 0; i <= 4; i++) {
      const x = padding + (graphWidth / 4) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, padding + graphHeight);
      ctx.stroke();
    }

    // Horizontal lines (speed)
    for (let i = 0; i <= 5; i++) {
      const y = padding + (graphHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + graphWidth, y);
      ctx.stroke();
    }

    // Draw axes labels
    ctx.fillStyle = "rgba(128, 128, 128, 0.8)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";

    // Time labels (bottom)
    ["0%", "25%", "50%", "75%", "100%"].forEach((label, i) => {
      const x = padding + (graphWidth / 4) * i;
      ctx.fillText(label, x, height - 5);
    });

    // Speed labels (left)
    ctx.textAlign = "right";
    ["5x", "4x", "3x", "2x", "1x", "0x"].forEach((label, i) => {
      const y = padding + (graphHeight / 5) * i + 3;
      ctx.fillText(label, padding - 5, y);
    });

    // Helper function to convert speed to Y coordinate (0x at bottom, 5x at top)
    const speedToY = (speed: number) => {
      const normalizedSpeed = Math.max(0, Math.min(5, speed)) / 5;
      return padding + graphHeight * (1 - normalizedSpeed);
    };

    // Helper function to convert time to X coordinate
    const timeToX = (time: number) => {
      return padding + graphWidth * Math.max(0, Math.min(1, time));
    };

    // Draw the speed curve
    if (speedCurve && speedCurve.keyframes.length > 0) {
      const keyframes = [...speedCurve.keyframes].sort((a, b) => a.time - b.time);

      // Draw curve line
      ctx.strokeStyle = "rgba(59, 130, 246, 0.8)"; // blue
      ctx.lineWidth = 2;
      ctx.beginPath();

      // Sample points along the curve
      const numSamples = 100;
      for (let i = 0; i <= numSamples; i++) {
        const t = i / numSamples;
        const speed = calculateSpeedAtTime(speedCurve, t);
        const x = timeToX(t);
        const y = speedToY(speed);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Draw keyframes as circles
      keyframes.forEach((kf, index) => {
        const x = timeToX(kf.time);
        const y = speedToY(kf.speed);
        const isHovered = hoveredKeyframe === index;
        const isDragging = draggingKeyframe === index;

        // Keyframe circle
        ctx.fillStyle = isDragging
          ? "rgba(59, 130, 246, 1)"
          : isHovered
            ? "rgba(59, 130, 246, 0.8)"
            : "rgba(59, 130, 246, 0.6)";
        ctx.beginPath();
        ctx.arc(x, y, isDragging ? 6 : isHovered ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();

        // White border
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    } else {
      // Draw default 1x speed line
      ctx.strokeStyle = "rgba(128, 128, 128, 0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      const y = speedToY(1.0);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + graphWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw playhead indicator
    const playheadX = timeToX(normalizedTime);
    ctx.strokeStyle = "rgba(239, 68, 68, 0.8)"; // red
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, padding);
    ctx.lineTo(playheadX, padding + graphHeight);
    ctx.stroke();

    // Draw current speed indicator dot
    const currentSpeedY = speedToY(currentSpeed);
    ctx.fillStyle = "rgba(239, 68, 68, 1)";
    ctx.beginPath();
    ctx.arc(playheadX, currentSpeedY, 4, 0, Math.PI * 2);
    ctx.fill();
  }, [speedCurve, normalizedTime, currentSpeed, hoveredKeyframe, draggingKeyframe]);

  const handleApplyPreset = useCallback(
    (presetId: string) => {
      const preset = SPEED_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        onSpeedCurveChange({ keyframes: [...preset.keyframes] });
        setPreviewPreset(null);
      }
    },
    [onSpeedCurveChange],
  );

  const handlePreviewPreset = useCallback((presetId: string | null) => {
    setPreviewPreset(presetId);
  }, []);

  const handleReset = useCallback(() => {
    onSpeedCurveChange(null);
    setPreviewPreset(null);
  }, [onSpeedCurveChange]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Current Speed Display */}
        <Card className="p-3 bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Current Speed</span>
            </div>
            <span className="text-lg font-bold text-primary">
              {currentSpeed.toFixed(2)}x
            </span>
          </div>
        </Card>

        {/* Curve Visualization */}
        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Speed Curve</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={!speedCurve}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
          </div>
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="w-full h-48 bg-background border border-border rounded"
              style={{ touchAction: "none" }}
            />
          </div>
        </Card>

        {/* Preset Library */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Film className="h-4 w-4" />
              Speed Presets
            </h3>
            <div className="flex gap-1">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
                className="h-7 px-2 text-xs"
              >
                All
              </Button>
              <Button
                variant={selectedCategory === "ramps" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("ramps")}
                className="h-7 px-2 text-xs"
              >
                Ramps
              </Button>
              <Button
                variant={selectedCategory === "effects" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("effects")}
                className="h-7 px-2 text-xs"
              >
                Effects
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {filteredPresets.map((preset) => {
              const isActive = speedCurve &&
                JSON.stringify(speedCurve.keyframes) === JSON.stringify(preset.keyframes);
              const isPreviewing = previewPreset === preset.id;

              return (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset.id)}
                  onMouseEnter={() => handlePreviewPreset(preset.id)}
                  onMouseLeave={() => handlePreviewPreset(null)}
                  className={`group relative rounded-lg border-2 text-left transition-all cursor-pointer p-2 ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : isPreviewing
                        ? "border-primary/50 bg-accent"
                        : "border-border bg-card hover:border-primary/30 hover:bg-accent"
                  }`}
                >
                  {/* Thumbnail Preview */}
                  <div className="mb-2 rounded overflow-hidden bg-muted/30 flex items-center justify-center h-12">
                    <img
                      src={generatePresetThumbnail(preset, 120, 48)}
                      alt={`${preset.name} curve`}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Preset Info */}
                  <div className="space-y-0.5">
                    <p className={`text-xs font-semibold leading-tight ${
                      isActive ? "text-primary" : "text-foreground"
                    }`}>
                      {preset.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                      {preset.description}
                    </p>
                  </div>

                  {/* Active Indicator */}
                  {isActive && (
                    <div className="absolute top-1 right-1">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Help Text */}
        <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded">
          <p className="font-medium mb-1">How to use:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Hover over presets to preview their curves</li>
            <li>Click a preset to apply it instantly</li>
            <li>Filter by category (Ramps or Effects)</li>
            <li>The red line shows your current playhead position</li>
            <li>Active preset is highlighted with a blue dot</li>
          </ul>
        </div>
      </div>
    </ScrollArea>
  );
};
