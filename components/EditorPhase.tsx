"use client";

import { useState, useRef, useEffect } from "react";
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
  clips: any[];
  onExport: () => void;
}

export const EditorPhase = ({ clips, onExport }: EditorPhaseProps) => {
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const totalDuration = clips.reduce((sum, clip) => sum + clip.duration, 0);
  const currentClip = clips[currentClipIndex];

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle video ended - play next clip
  const handleVideoEnded = () => {
    if (currentClipIndex < clips.length - 1) {
      setCurrentClipIndex(currentClipIndex + 1);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  // Handle play/pause
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Handle next clip
  const nextClip = () => {
    if (currentClipIndex < clips.length - 1) {
      setCurrentClipIndex(currentClipIndex + 1);
    }
  };

  // Handle previous clip
  const prevClip = () => {
    if (currentClipIndex > 0) {
      setCurrentClipIndex(currentClipIndex - 1);
    }
  };

  // Update volume when slider changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Auto-play when clip changes
  useEffect(() => {
    if (videoRef.current && isPlaying) {
      videoRef.current.play();
    }
  }, [currentClipIndex]);

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
              {currentClip?.videoUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={currentClip.videoUrl}
                    className="w-full h-full object-contain"
                    onEnded={handleVideoEnded}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  />
                  {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <button
                        onClick={togglePlayPause}
                        className="w-16 h-16 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Play className="w-8 h-8 text-primary-foreground ml-1" />
                      </button>
                    </div>
                  )}
                  <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded">
                    <span className="text-white text-sm font-medium">
                      Clip {currentClipIndex + 1} of {clips.length}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center text-muted-foreground">
                  No video available
                </div>
              )}
            </div>
          </div>

          {/* Playback Controls */}
          <div className="border-t border-border bg-card p-4">
            <div className="max-w-4xl mx-auto space-y-3">
              {/* Control Buttons */}
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={prevClip}
                  disabled={currentClipIndex === 0}
                >
                  <SkipBack className="w-5 h-5" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  className="w-12 h-12"
                  onClick={togglePlayPause}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6 ml-0.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={nextClip}
                  disabled={currentClipIndex === clips.length - 1}
                >
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
                  onValueChange={([v]) => {
                    setCurrentTime(v);
                    if (videoRef.current) {
                      videoRef.current.currentTime = v;
                    }
                  }}
                  min={0}
                  max={currentClip?.duration || 0}
                  step={0.1}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(currentClip?.duration || 0)}</span>
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
                      key={clip._id}
                      style={{ width: `${clip.duration * 10}px` }}
                      className={`relative shrink-0 h-16 rounded overflow-hidden border-2 transition-colors cursor-pointer group ${
                        index === currentClipIndex
                          ? "border-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setCurrentClipIndex(index)}
                    >
                      {clip.videoUrl ? (
                        <video
                          src={clip.videoUrl}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <div className="w-full h-full bg-accent flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">
                            Clip {index + 1}
                          </span>
                        </div>
                      )}
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
