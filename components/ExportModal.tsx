"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  duration: number;
  onExport: (options: ExportConfig) => Promise<void>;
  status?: { progress: number; status: string } | null;
}

export type ExportConfig = {
  resolution: string;
  quality: string;
  format: string;
  aspectRatio: string;
};

export const ExportModal = ({ open, onOpenChange, duration, onExport, status }: ExportModalProps) => {
  const [resolution, setResolution] = useState("1080p");
  const [quality, setQuality] = useState("high");
  const [format, setFormat] = useState("mp4");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [state, setState] = useState<"config" | "exporting" | "complete">("config");

  useEffect(() => {
    if (!open) {
      setState("config");
    }
  }, [open]);

  useEffect(() => {
    if (status?.progress === 100) {
      setState("complete");
    } else if (status) {
      setState("exporting");
    }
  }, [status]);

  const handleExport = async () => {
    setState("exporting");
    await onExport({ resolution, quality, format, aspectRatio });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Export Video</DialogTitle>
          <DialogDescription>Configure your export settings and download your video</DialogDescription>
        </DialogHeader>

        {state === "config" && (
          <ExportConfigurator
            resolution={resolution}
            quality={quality}
            format={format}
            aspectRatio={aspectRatio}
            duration={duration}
            onResolutionChange={setResolution}
            onQualityChange={setQuality}
            onFormatChange={setFormat}
            onAspectRatioChange={setAspectRatio}
            onExport={handleExport}
          />
        )}

        {state === "exporting" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-lg font-semibold">Encoding video…</p>
              <p className="text-muted-foreground">{status?.status ?? "Preparing frames"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {status ? Math.round(status.progress) : 0}%
              </p>
            </div>
          </div>
        )}

        {state === "complete" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
              <Check className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">Export Complete</p>
              <p className="text-muted-foreground">Your file has been saved locally.</p>
            </div>
            <Button onClick={() => onOpenChange(false)} className="gap-2">
              <Download className="h-4 w-4" /> Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface ConfiguratorProps {
  resolution: string;
  quality: string;
  format: string;
  aspectRatio: string;
  duration: number;
  onResolutionChange: (value: string) => void;
  onQualityChange: (value: string) => void;
  onFormatChange: (value: string) => void;
  onAspectRatioChange: (value: string) => void;
  onExport: () => void;
}

const ExportConfigurator = ({
  resolution,
  quality,
  format,
  aspectRatio,
  duration,
  onResolutionChange,
  onQualityChange,
  onFormatChange,
  onAspectRatioChange,
  onExport,
}: ConfiguratorProps) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const calculateFileSize = () => {
    const durationMinutes = duration / 60;
    const resMultipliers: Record<string, number> = {
      "720p": 1,
      "1080p": 2,
      "1440p": 3.5,
      "4k": 6,
    };
    const qualityMultipliers: Record<string, number> = {
      low: 0.5,
      medium: 1,
      high: 1.5,
    };
    const size =
      durationMinutes * 50 * (resMultipliers[resolution] ?? 1) * (qualityMultipliers[quality] ?? 1);
    return Math.round(size);
  };

  const getResolutionOutput = () => ({
    "720p": "1280x720",
    "1080p": "1920x1080",
    "1440p": "2560x1440",
    "4k": "3840x2160",
  })[resolution];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <SelectCard label="Resolution" value={resolution} onChange={onResolutionChange}>
          <SelectItem value="720p">720p (HD)</SelectItem>
          <SelectItem value="1080p">1080p (Full HD)</SelectItem>
          <SelectItem value="1440p">1440p (2K)</SelectItem>
          <SelectItem value="4k">4K (Ultra HD)</SelectItem>
        </SelectCard>
        <SelectCard label="Quality" value={quality} onChange={onQualityChange}>
          <SelectItem value="low">Low (Fast)</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High (Best)</SelectItem>
        </SelectCard>
        <SelectCard label="Format" value={format} onChange={onFormatChange}>
          <SelectItem value="mp4">MP4 (H.264)</SelectItem>
          <SelectItem value="webm">WebM (VP9)</SelectItem>
          <SelectItem value="mov">MOV (ProRes)</SelectItem>
        </SelectCard>
        <SelectCard label="Aspect Ratio" value={aspectRatio} onChange={onAspectRatioChange}>
          <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
          <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
          <SelectItem value="1:1">1:1 (Square)</SelectItem>
          <SelectItem value="4:5">4:5 (Portrait)</SelectItem>
        </SelectCard>
      </div>
      <Card className="p-4 bg-accent/30">
        <h4 className="font-semibold mb-3">Export Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration:</span>
            <span className="font-medium">{formatDuration(duration)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Output Resolution:</span>
            <span className="font-medium">{getResolutionOutput()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Estimated File Size:</span>
            <span className="font-medium">{calculateFileSize()} MB</span>
          </div>
        </div>
      </Card>
      <div className="flex justify-end">
        <Button onClick={onExport} className="gap-2">
          <Download className="h-4 w-4" /> Start Export
        </Button>
      </div>
    </div>
  );
};

const SelectCard = ({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) => (
  <div>
    <label className="text-sm font-medium mb-2 block">{label}</label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  </div>
);
