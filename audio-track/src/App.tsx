import { VoiceDemo } from './components/VoiceDemo';
import { useState } from 'react';

export default function App() {
  const voices = [
    {
      id: 1,
      name: 'Friendly Person',
      provider: 'Replicate (MiniMax)',
      description: 'Friendly_Person delivers a warm, approachable tone that matches the playful nature of a gorilla eating a banana, while the happy emotion and slightly faster speed keep the narration lively for an adult audience.',
    },
    {
      id: 2,
      name: 'Professional Narrator',
      provider: 'ElevenLabs',
      description: 'A clear, authoritative voice perfect for documentaries and educational content. Maintains a steady pace with excellent pronunciation and natural inflection.',
    },
    {
      id: 3,
      name: 'Casual Storyteller',
      provider: 'Azure Speech',
      description: 'A relaxed, conversational tone ideal for lifestyle content and vlogs. Creates an intimate connection with listeners through natural pauses and expressive delivery.',
    },
  ];

  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);
  const selectedVoice = voices[selectedVoiceIndex];

  const handleChangeVoice = () => {
    setSelectedVoiceIndex((prev) => (prev + 1) % voices.length);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-white text-3xl mb-2">Voice Narration Demo</h1>
          <p className="text-gray-400">Click "Change Voice" to preview different narration styles</p>
        </div>
        
        <VoiceDemo
          voiceName={selectedVoice.name}
          provider={selectedVoice.provider}
          description={selectedVoice.description}
          duration={3}
          onChangeVoice={handleChangeVoice}
        />
      </div>
    </div>
  );
}
