import { Play, Pause, Volume2, MoreVertical } from 'lucide-react';
import { useState, useEffect } from 'react';

interface VoiceDemoProps {
  voiceName: string;
  provider: string;
  description: string;
  duration?: number;
  onChangeVoice?: () => void;
}

export function VoiceDemo({
  voiceName,
  provider,
  description,
  duration = 3,
  onChangeVoice,
}: VoiceDemoProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setIsPlaying(false);
          return 0;
        }
        return prev + (100 / (duration * 20)); // Update every 50ms
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  // Generate waveform data
  const waveformBars = Array.from({ length: 100 }, (_, i) => {
    const position = i / 100;
    const height = Math.sin(position * Math.PI * 8) * 0.4 + 
                   Math.sin(position * Math.PI * 3) * 0.3 + 
                   Math.random() * 0.3;
    return Math.abs(height);
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds);
    const secs = Math.floor((seconds % 1) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentTime = (progress / 100) * duration;

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      {/* Header Section */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-gray-400" />
            <h2 className="text-white">Narration Voice</h2>
          </div>
          {onChangeVoice && (
            <button
              onClick={onChangeVoice}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
            >
              Change Voice
            </button>
          )}
        </div>
        
        <div className="mb-2">
          <div className="text-white mb-1">{voiceName} • {provider}</div>
        </div>
        
        <p className="text-gray-400 text-sm leading-relaxed">
          {description}
        </p>
      </div>

      {/* Audio Player Section */}
      <div className="bg-white rounded-full mx-6 mb-6 p-3 flex items-center gap-3">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-8 h-8 rounded-full bg-gray-900 hover:bg-gray-800 text-white flex items-center justify-center flex-shrink-0 transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>
        
        <div className="flex-1 flex items-center gap-2">
          <span className="text-sm text-gray-600 whitespace-nowrap">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          
          <div className="flex-1 h-8 flex items-center gap-px">
            {waveformBars.map((height, i) => {
              const isPassed = (i / waveformBars.length) * 100 < progress;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-all duration-100"
                  style={{
                    height: `${height * 100}%`,
                    backgroundColor: isPassed 
                      ? '#1f2937'
                      : '#d1d5db',
                  }}
                />
              );
            })}
          </div>
        </div>
        
        <button className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center flex-shrink-0 transition-colors">
          <Volume2 className="w-4 h-4 text-gray-600" />
        </button>
        
        <button className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center flex-shrink-0 transition-colors">
          <MoreVertical className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
}
