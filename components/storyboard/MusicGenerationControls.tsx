"use client";

import { useState } from "react";
import { Music, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetchJSON } from "@/lib/api-fetch";

interface MusicGenerationControlsProps {
  projectId: string;
  totalDuration: number;
  currentMusicUrl?: string;
  currentMusicPrompt?: string;
  onMusicGenerated: (url: string, prompt: string, source: "generated" | "freesound") => void;
}

interface AudioSearchResult {
  id: string;
  name: string;
  url: string;
  previewUrl?: string;
  durationSeconds: number;
  tags?: string[];
  username?: string;
}

export const MusicGenerationControls = ({
  projectId,
  totalDuration,
  currentMusicUrl,
  currentMusicPrompt,
  onMusicGenerated,
}: MusicGenerationControlsProps) => {
  const [musicPrompt, setMusicPrompt] = useState(currentMusicPrompt || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("uplifting cinematic");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<AudioSearchResult[]>([]);

  const handleGenerateMusic = async () => {
    if (!projectId) return;

    const trimmedPrompt = musicPrompt.trim() || "cinematic uplifting background music";
    const durationHint = Math.min(Math.max(totalDuration, 15), 90);

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const data = await apiFetchJSON("/api/generate-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          durationSeconds: durationHint,
        }),
      });

      if (!data.track?.audioUrl) {
        throw new Error("Failed to generate music. Please try again.");
      }

      onMusicGenerated(data.track.audioUrl, trimmedPrompt, "generated");
    } catch (error) {
      console.error("Music generation error:", error);
      setGenerationError(
        error instanceof Error ? error.message : "Failed to generate music"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSearchAudio = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const data = await apiFetchJSON("/api/search-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery.trim(),
          page: 1,
          perPage: 10,
        }),
      });

      if (!data.results) {
        throw new Error("Failed to search audio library");
      }

      setSearchResults(data.results.results || data.results);
    } catch (error) {
      console.error("Audio search error:", error);
      setSearchError(
        error instanceof Error ? error.message : "Failed to search audio"
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectAudioResult = (result: AudioSearchResult) => {
    onMusicGenerated(result.url, searchQuery, "freesound");
  };

  return (
    <Card className="p-4">
      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generate">
            <Music className="h-4 w-4 mr-2" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search className="h-4 w-4 mr-2" />
            Search Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="music-prompt">Music Prompt</Label>
            <Input
              id="music-prompt"
              placeholder="cinematic uplifting background music"
              value={musicPrompt}
              onChange={(e) => setMusicPrompt(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          <Button
            onClick={handleGenerateMusic}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Music...
              </>
            ) : (
              <>
                <Music className="h-4 w-4 mr-2" />
                Generate Background Music
              </>
            )}
          </Button>

          {generationError && (
            <p className="text-sm text-red-500">{generationError}</p>
          )}

          {currentMusicUrl && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Current music: {currentMusicPrompt || "Generated track"}
              </p>
              <audio src={currentMusicUrl} controls className="w-full" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search-query">Search Query</Label>
            <div className="flex gap-2">
              <Input
                id="search-query"
                placeholder="uplifting cinematic"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isSearching}
                onKeyDown={(e) => e.key === "Enter" && handleSearchAudio()}
              />
              <Button
                onClick={handleSearchAudio}
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {searchError && (
            <p className="text-sm text-red-500">{searchError}</p>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((result) => (
                <Card
                  key={result.id}
                  className="p-3 hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleSelectAudioResult(result)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{result.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {result.durationSeconds}s
                        {result.username && ` • ${result.username}`}
                      </p>
                    </div>
                    {result.previewUrl && (
                      <audio
                        src={result.previewUrl}
                        controls
                        className="h-8"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
};
