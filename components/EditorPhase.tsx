"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExportModal } from "@/components/ExportModal";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Download,
} from "lucide-react";

interface EditorPhaseProps {
  videoUrl: string;
  onExport: () => void;
}

export const EditorPhase = ({ videoUrl, onExport }: EditorPhaseProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // Mock video clips for timeline
  const clips = [
    {
      id: "1",
      duration: 8,
      thumbnail:
        "https://images.unsplash.com/photo-1557683316-973673baf926?w=200&h=112&fit=crop",
    },
    {
      id: "2",
      duration: 12,
      thumbnail:
        "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=200&h=112&fit=crop",
    },
    {
      id: "3",
      duration: 10,
      thumbnail:
        "https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=200&h=112&fit=crop",
    },
    {
      id: "4",
      duration: 15,
      thumbnail:
        "https://images.unsplash.com/photo-1557682268-e3955ed5d83f?w=200&h=112&fit=crop",
    },
    {
      id: "5",
      duration: 8,
      thumbnail:
        "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=200&h=112&fit=crop",
    },
  ];

  const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Top Toolbar */}
      <div className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">Video Editor</h2>
          <p className="text-sm text-muted-foreground">
            Total Duration: {formatTime(totalDuration)}
          </p>
        </div>
        <Button
          onClick={() => setExportModalOpen(true)}
          size="lg"
          className="bg-primary hover:bg-primary/90"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Video
        </Button>
      </div>

      {/* Main Editor Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-80 border-r border-border bg-card p-4 overflow-y-auto">
          <Tabs defaultValue="text" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="transitions">Transitions</TabsTrigger>
              <TabsTrigger value="effects">Effects</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Add Text Overlay
                </label>
                <Input placeholder="Enter text..." className="mb-3" />
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Font Size
                    </label>
                    <Slider defaultValue={[24]} min={12} max={72} step={1} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Position X
                    </label>
                    <Slider defaultValue={[50]} min={0} max={100} step={1} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Position Y
                    </label>
                    <Slider defaultValue={[50]} min={0} max={100} step={1} />
                  </div>
                  <Button variant="outline" className="w-full">
                    Add to Timeline
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="transitions" className="space-y-3 mt-4">
              {["Fade", "Dissolve", "Wipe", "Slide", "Zoom"].map(
                (transition) => (
                  <Button
                    key={transition}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    {transition}
                  </Button>
                ),
              )}
            </TabsContent>

            <TabsContent value="effects" className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Color Grading
                </label>
                <div className="space-y-2">
                  {["None", "Cinematic", "Vibrant", "Vintage"].map((effect) => (
                    <Button
                      key={effect}
                      variant="outline"
                      className="w-full justify-start"
                    >
                      {effect}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Speed</label>
                <div className="grid grid-cols-4 gap-2">
                  {["0.5x", "1x", "1.5x", "2x"].map((speed) => (
                    <Button key={speed} variant="outline" size="sm">
                      {speed}
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Center - Preview & Timeline */}
        <div className="flex-1 flex flex-col">
          {/* Video Preview */}
          <div className="flex-1 bg-background flex items-center justify-center p-6">
            <div className="relative w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&h=675&fit=crop"
                alt="Video preview"
                className="w-full h-full object-cover"
              />
              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <button
                    onClick={() => setIsPlaying(true)}
                    className="w-16 h-16 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Play className="w-8 h-8 text-primary-foreground ml-1" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Playback Controls */}
          <div className="border-t border-border bg-card p-4">
            <div className="max-w-4xl mx-auto space-y-3">
              {/* Control Buttons */}
              <div className="flex items-center justify-center gap-2">
                <Button variant="ghost" size="icon">
                  <SkipBack className="w-5 h-5" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  className="w-12 h-12"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6 ml-0.5" />
                  )}
                </Button>
                <Button variant="ghost" size="icon">
                  <SkipForward className="w-5 h-5" />
                </Button>
                <div className="flex items-center gap-2 ml-4">
                  <Volume2 className="w-4 h-4 text-muted-foreground" />
                  <Slider
                    value={[volume]}
                    onValueChange={([v]) => setVolume(v)}
                    min={0}
                    max={100}
                    className="w-24"
                  />
                </div>
              </div>

              {/* Time Scrubber */}
              <div className="space-y-2">
                <Slider
                  value={[currentTime]}
                  onValueChange={([v]) => setCurrentTime(v)}
                  min={0}
                  max={totalDuration}
                  step={0.1}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(totalDuration)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="border-t border-border bg-card p-4">
            <div className="space-y-4">
              {/* Video Track */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs">
                    VIDEO
                  </Badge>
                </div>
                <div className="flex gap-1 overflow-x-auto pb-2">
                  {clips.map((clip, index) => (
                    <div
                      key={clip.id}
                      style={{ width: `${clip.duration * 10}px` }}
                      className="relative shrink-0 h-16 rounded overflow-hidden border-2 border-border hover:border-primary transition-colors cursor-pointer group"
                    >
                      <img
                        src={clip.thumbnail}
                        alt={`Clip ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent">
                        <Badge className="absolute bottom-1 left-1 text-xs">
                          {clip.duration}s
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audio Track */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs">
                    AUDIO
                  </Badge>
                </div>
                <div className="h-12 bg-accent/30 rounded flex items-center px-2 overflow-hidden">
                  {/* Waveform visualization */}
                  <div className="flex items-end gap-0.5 h-full w-full">
                    {Array.from({ length: 100 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-primary/30 rounded-sm"
                        style={{
                          height: `${Math.random() * 60 + 20}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        duration={totalDuration}
      />
    </div>
  );
};
