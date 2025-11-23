"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Activity, Scissors } from "lucide-react";
import { previewAutoSplice } from "@/lib/editor/utils/auto-splice";
import type { Project } from "@/lib/editor/types";

interface AutoSpliceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  clipId: string;
  onConfirm: (options: {
    beatsPerCut: number;
    minStrength: number;
    alignmentOffset: number;
    downbeatsOnly: boolean;
  }) => void;
}

export function AutoSpliceDialog({
  open,
  onOpenChange,
  project,
  clipId,
  onConfirm,
}: AutoSpliceDialogProps) {
  const [beatsPerCut, setBeatsPerCut] = useState(4);
  const [minStrength, setMinStrength] = useState(0.8);
  const [alignmentOffset, setAlignmentOffset] = useState(0);
  const [downbeatsOnly, setDownbeatsOnly] = useState(false);

  // Calculate preview
  const preview = project
    ? previewAutoSplice(project, clipId, {
        beatsPerCut,
        minStrength,
        alignmentOffset,
        downbeatsOnly,
      })
    : null;

  const handleConfirm = () => {
    onConfirm({
      beatsPerCut,
      minStrength,
      alignmentOffset,
      downbeatsOnly,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            Auto-Splice on Beats
          </DialogTitle>
          <DialogDescription>
            Automatically split this clip at detected beat markers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Preview */}
          {preview && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Preview</span>
                </div>
                {preview.success ? (
                  <span className="text-sm text-muted-foreground">
                    Will create <span className="font-bold text-foreground">{preview.cutCount + 1}</span> clips
                  </span>
                ) : (
                  <span className="text-sm text-destructive">{preview.error}</span>
                )}
              </div>
            </div>
          )}

          {/* Beats Per Cut */}
          <div className="space-y-2">
            <Label htmlFor="beats-per-cut">Beats Per Cut</Label>
            <Select
              value={beatsPerCut.toString()}
              onValueChange={(value) => setBeatsPerCut(Number(value))}
            >
              <SelectTrigger id="beats-per-cut">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Every beat (maximum cuts)</SelectItem>
                <SelectItem value="2">Every 2 beats</SelectItem>
                <SelectItem value="4">Every 4 beats (phrase-level)</SelectItem>
                <SelectItem value="8">Every 8 beats (section-level)</SelectItem>
                <SelectItem value="16">Every 16 beats (large sections)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How often to cut the clip based on detected beats
            </p>
          </div>

          {/* Minimum Strength */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="min-strength">Minimum Beat Strength</Label>
              <span className="text-sm text-muted-foreground">
                {minStrength.toFixed(2)}
              </span>
            </div>
            <Slider
              id="min-strength"
              min={0}
              max={1}
              step={0.1}
              value={[minStrength]}
              onValueChange={([value]) => setMinStrength(value)}
            />
            <p className="text-xs text-muted-foreground">
              Higher values = only strong/prominent beats
            </p>
          </div>

          {/* Downbeats Only */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="downbeats-only">Downbeats Only</Label>
              <p className="text-xs text-muted-foreground">
                Cut only on downbeats (typically every 4th beat)
              </p>
            </div>
            <Switch
              id="downbeats-only"
              checked={downbeatsOnly}
              onCheckedChange={setDownbeatsOnly}
            />
          </div>

          {/* Alignment Offset */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="alignment-offset">Alignment Offset</Label>
              <span className="text-sm text-muted-foreground">
                {alignmentOffset >= 0 ? "+" : ""}
                {alignmentOffset.toFixed(2)}s
              </span>
            </div>
            <Slider
              id="alignment-offset"
              min={-0.1}
              max={0.1}
              step={0.01}
              value={[alignmentOffset]}
              onValueChange={([value]) => setAlignmentOffset(value)}
            />
            <p className="text-xs text-muted-foreground">
              Negative = cut before beat, Positive = cut after beat
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!preview?.success}
          >
            <Scissors className="mr-2 h-4 w-4" />
            Splice Clip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
