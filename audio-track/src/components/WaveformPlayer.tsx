import { Play, Pause, Volume2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

export function WaveformPlayer() {
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
        return prev + 0.5;
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Generate waveform data
  const waveformBars = Array.from({ length: 100 }, (_, i) => {
    const position = i / 100;
    const height = Math.sin(position * Math.PI * 8) * 0.4 + 
                   Math.sin(position * Math.PI * 3) * 0.3 + 
                   Math.random() * 0.3;
    return Math.abs(height);
  });

  return (
    <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-2xl p-6 shadow-2xl">
      <div className="mb-4">
        <h3 className="text-white mb-1">Waveform Visualization</h3>
        <p className="text-purple-200 text-sm">Classic amplitude display</p>
      </div>
      
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-12 h-12 rounded-full bg-white text-purple-900 flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        
        <div className="flex-1 h-20 flex items-center gap-0.5">
          {waveformBars.map((height, i) => {
            const isPassed = (i / waveformBars.length) * 100 < progress;
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-all duration-100"
                style={{
                  height: `${height * 100}%`,
                  backgroundColor: isPassed 
                    ? 'rgba(255, 255, 255, 0.9)' 
                    : 'rgba(255, 255, 255, 0.3)',
                }}
              />
            );
          })}
        </div>
        
        <Volume2 className="w-5 h-5 text-white" />
      </div>
      
      <div className="mt-4 flex justify-between text-sm text-purple-200">
        <span>{Math.floor(progress * 3 / 100)}:{((progress * 3) % 60).toFixed(0).padStart(2, '0')}</span>
        <span>3:00</span>
      </div>
    </div>
  );
}
