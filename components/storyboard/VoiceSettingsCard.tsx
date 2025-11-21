import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";

interface VoiceSettingsCardProps {
  currentVoiceLabel: string;
  currentVoiceReasoning: string;
  sampleAudioUrl?: string;
  onShowVoiceDialog: () => void;
}

export const VoiceSettingsCard = ({
  currentVoiceLabel,
  currentVoiceReasoning,
  sampleAudioUrl,
  onShowVoiceDialog,
}: VoiceSettingsCardProps) => {
  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-medium flex items-center gap-2">
            <Volume2 className="w-4 h-4" /> Narration Voice
          </h3>
          <p className="text-sm text-muted-foreground">
            {currentVoiceLabel} — {currentVoiceReasoning}
          </p>
        </div>
        <Button variant="outline" onClick={onShowVoiceDialog}>
          Change Voice
        </Button>
      </div>
      {sampleAudioUrl ? (
        <audio controls className="w-full mt-3">
          <source src={sampleAudioUrl} type="audio/wav" />
          Your browser does not support the audio element.
        </audio>
      ) : (
        <p className="text-sm text-muted-foreground mt-3">
          Generate narration to preview the selected voice.
        </p>
      )}
    </Card>
  );
};
