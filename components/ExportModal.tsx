"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Check, Download } from "lucide-react";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duration: number; // in seconds
}

type ExportState = "config" | "exporting" | "complete";

export const ExportModal = ({
  open,
  onOpenChange,
  duration,
}: ExportModalProps) => {
  const [state, setState] = useState<ExportState>("config");
  const [resolution, setResolution] = useState("1080p");
  const [quality, setQuality] = useState("high");
  const [format, setFormat] = useState("mp4");
  const [aspectRatio, setAspectRatio] = useState("16:9");

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const calculateFileSize = () => {
    const durationMinutes = duration / 60;
    let baseSize = 50 * durationMinutes; // 50MB per minute base

    // Resolution multiplier
    const resMultipliers: Record<string, number> = {
      "720p": 1,
      "1080p": 2,
      "1440p": 3.5,
      "4k": 6,
    };

    // Quality multiplier
    const qualityMultipliers: Record<string, number> = {
      low: 0.5,
      medium: 1,
      high: 1.5,
    };

    const size =
      baseSize * resMultipliers[resolution] * qualityMultipliers[quality];
    return Math.round(size);
  };

  const getResolutionOutput = () => {
    const resolutions: Record<string, string> = {
      "720p": "1280x720",
      "1080p": "1920x1080",
      "1440p": "2560x1440",
      "4k": "3840x2160",
    };
    return resolutions[resolution];
  };

  const handleExport = () => {
    setState("exporting");
    // Simulate export process
    setTimeout(() => {
      setState("complete");
    }, 3000);
  };

  const handleDownload = () => {
    // Simulate download
    console.log("Downloading video...");
    onOpenChange(false);
    // Reset state after closing
    setTimeout(() => setState("config"), 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Export Video</DialogTitle>
          <DialogDescription>
            Configure your export settings and download your video
          </DialogDescription>
        </DialogHeader>

        {state === "config" && (
          <div className="space-y-6 mt-4">
            {/* Export Settings */}
            <div className="grid grid-cols-2 gap-4">
              {/* Resolution */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Resolution
                </label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="720p">720p (HD)</SelectItem>
                    <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                    <SelectItem value="1440p">1440p (2K)</SelectItem>
                    <SelectItem value="4k">4K (Ultra HD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quality */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Quality
                </label>
                <Select value={quality} onValueChange={setQuality}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (Fast)</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High (Best)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Format */}
              <div>
                <label className="text-sm font-medium mb-2 block">Format</label>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mp4">MP4 (H.264)</SelectItem>
                    <SelectItem value="webm">WebM (VP9)</SelectItem>
                    <SelectItem value="mov">MOV (ProRes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Aspect Ratio
                </label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                    <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                    <SelectItem value="1:1">1:1 (Square)</SelectItem>
                    <SelectItem value="4:5">4:5 (Portrait)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Export Summary */}
            <Card className="p-4 bg-accent/30">
              <h4 className="font-semibold mb-3">Export Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium">
                    {formatDuration(duration)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Output Resolution:
                  </span>
                  <span className="font-medium">{getResolutionOutput()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Estimated File Size:
                  </span>
                  <span className="font-medium">{calculateFileSize()} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Estimated Render Time:
                  </span>
                  <span className="font-medium">2-3 minutes</span>
                </div>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                className="bg-primary hover:bg-primary/90"
              >
                Export Video
              </Button>
            </div>
          </div>
        )}

        {state === "exporting" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
            <h3 className="text-xl font-semibold mb-2">Exporting Video...</h3>
            <p className="text-muted-foreground text-center">
              This may take a few minutes. Please don't close this window.
            </p>
          </div>
        )}

        {state === "complete" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Export Complete!</h3>
            <p className="text-muted-foreground text-center mb-6">
              Your video is ready to download
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={handleDownload}
                className="bg-linear-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              >
                <Download className="w-4 h-4 mr-2" />
                Download File
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
