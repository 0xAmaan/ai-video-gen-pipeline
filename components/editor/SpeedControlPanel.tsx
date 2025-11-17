"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Card } from "../ui/card";
import { Slider } from "../ui/slider";
import type { SpeedCurve, SpeedKeyframe } from "@/lib/editor/types";
import { calculateSpeedAtTime } from "@/lib/editor/effects/speed-interpolation";
import {
  Gauge,
  Zap,
  TrendingUp,
  TrendingDown,
  Pause,
  RotateCcw,
} from "lucide-react";

interface SpeedControlPanelProps {
  speedCurve: SpeedCurve | null;
  clipDuration: number;
  currentTime: number; // Current playhead position within clip (0 to clipDuration)
  onSpeedCurveChange: (curve: SpeedCurve | null) => void;
}

interface SpeedPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  keyframes: SpeedKeyframe[];
}

const SPEED_PRESETS: SpeedPreset[] = [
  {
    id: "slow-to-fast",
    name: "Slow to Fast",
    description: "Speed ramp from 0.5x to 2x",
    icon: TrendingUp,
    keyframes: [
      { time: 0, speed: 0.5 },
      { time: 1, speed: 2.0 },
    ],
  },
  {
    id: "fast-to-slow",
    name: "Fast to Slow",
    description: "Speed ramp from 2x to 0.5x",
    icon: TrendingDown,
    keyframes: [
      { time: 0, speed: 2.0 },
      { time: 1, speed: 0.5 },
    ],
  },
  {
    id: "freeze-mid",
    name: "Freeze Frame",
    description: "Freeze in the middle",
    icon: Pause,
    keyframes: [
      { time: 0, speed: 1.0 },
      { time: 0.45, speed: 1.0 },
      { time: 0.5, speed: 0 },
      { time: 0.55, speed: 1.0 },
      { time: 1, speed: 1.0 },
    ],
  },
];

export const SpeedControlPanel = ({
  speedCurve,
  clipDuration,
  currentTime,
  onSpeedCurveChange,
}: SpeedControlPanelProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredKeyframe, setHoveredKeyframe] = useState<number | null>(null);
  const [draggingKeyframe, setDraggingKeyframe] = useState<number | null>(null);

  // Current speed at playhead position
  const normalizedTime = clipDuration > 0 ? currentTime / clipDuration : 0;
  const currentSpeed = calculateSpeedAtTime(speedCurve, normalizedTime);

  // Draw the curve visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
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
    (preset: SpeedPreset) => {
      onSpeedCurveChange({ keyframes: [...preset.keyframes] });
    },
    [onSpeedCurveChange],
  );

  const handleReset = useCallback(() => {
    onSpeedCurveChange(null);
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

        {/* Preset Buttons */}
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Speed Presets
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {SPEED_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className="group w-full rounded-lg border border-border bg-card hover:border-primary hover:bg-accent text-left transition-all cursor-pointer p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {preset.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {preset.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Help Text */}
        <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded">
          <p className="font-medium mb-1">How to use:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Select a preset to apply a speed ramp</li>
            <li>The red line shows your current playhead position</li>
            <li>Future: Click to add keyframes, drag to adjust</li>
          </ul>
        </div>
      </div>
    </ScrollArea>
  );
};
