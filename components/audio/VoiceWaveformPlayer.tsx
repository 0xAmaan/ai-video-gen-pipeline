import { Play, Pause, Volume2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface VoiceWaveformPlayerProps {
  audioUrl: string;
  voiceName?: string;
  provider?: string;
  narrationText?: string;
  onChangeVoice?: () => void;
}

export function VoiceWaveformPlayer({
  audioUrl,
  voiceName = "AI Narrator",
  provider = "ElevenLabs",
  narrationText,
  onChangeVoice,
}: VoiceWaveformPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Generate waveform data (same as original)
  const waveformBars = Array.from({ length: 100 }, (_, i) => {
    const position = i / 100;
    const height = Math.sin(position * Math.PI * 8) * 0.4 +
                   Math.sin(position * Math.PI * 3) * 0.3 +
                   Math.random() * 0.3;
    return Math.abs(height);
  });

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Hidden audio element for actual playback */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Header Section */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-foreground font-medium">Narration Voice</h3>
          </div>
          {onChangeVoice && (
            <button
              onClick={onChangeVoice}
              className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg transition-colors text-sm"
            >
              Change Voice
            </button>
          )}
        </div>

        <div className="mb-2">
          <div className="text-foreground mb-1 text-sm">{voiceName} • {provider}</div>
        </div>

        {narrationText && (
          <p className="text-muted-foreground text-sm leading-relaxed italic">
            "{narrationText}"
          </p>
        )}
      </div>

      {/* Audio Player Section */}
      <div className="bg-background rounded-full mx-6 mb-6 p-3 flex items-center gap-3 border border-border">
        <button
          onClick={togglePlayPause}
          className="w-8 h-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center flex-shrink-0 transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>

        <div className="flex-1 flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1 h-8 flex items-center gap-0.5">
            {waveformBars.map((height, i) => {
              const isPassed = (i / waveformBars.length) * 100 < progress;
              return (
                <div
                  key={i}
                  className="w-1 min-w-[2px] rounded-full transition-all duration-100"
                  style={{
                    height: `${Math.max(height * 100, 10)}%`,
                    backgroundColor: isPassed
                      ? 'hsl(var(--primary))'
                      : 'hsl(var(--muted))',
                  }}
                />
              );
            })}
          </div>
        </div>

        <button
          className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center flex-shrink-0 transition-colors"
          onClick={() => {
            if (audioRef.current) {
              audioRef.current.volume = audioRef.current.volume > 0 ? 0 : 1;
            }
          }}
        >
          <Volume2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
