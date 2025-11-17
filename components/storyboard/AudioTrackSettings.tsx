"use client";

import { Volume2, VolumeX } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface AudioTrack {
  volume: number;
  muted: boolean;
}

interface AudioTrackSettingsProps {
  narration: AudioTrack;
  bgm: AudioTrack;
  sfx: AudioTrack;
  onUpdate: (
    track: "narration" | "bgm" | "sfx",
    settings: Partial<AudioTrack>
  ) => void;
}

export const AudioTrackSettings = ({
  narration,
  bgm,
  sfx,
  onUpdate,
}: AudioTrackSettingsProps) => {
  const tracks = [
    { key: "narration" as const, label: "Narration", settings: narration },
    { key: "bgm" as const, label: "Background Music", settings: bgm },
    { key: "sfx" as const, label: "Sound Effects", settings: sfx },
  ];

  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-semibold text-sm">Audio Levels</h3>

      {tracks.map(({ key, label, settings }) => (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{label}</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdate(key, { muted: !settings.muted })}
              className="h-8 w-8 p-0"
            >
              {settings.muted ? (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Slider
              value={[settings.muted ? 0 : settings.volume * 100]}
              onValueChange={(value) =>
                onUpdate(key, { volume: value[0] / 100 })
              }
              max={100}
              step={1}
              disabled={settings.muted}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10 text-right">
              {settings.muted ? "0%" : `${Math.round(settings.volume * 100)}%`}
            </span>
          </div>
        </div>
      ))}
    </Card>
  );
};
