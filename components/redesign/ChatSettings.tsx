"use client";

import { useState } from "react";
import { Wand2, Volume2, Clock, Monitor, Ratio, Film } from "lucide-react";

export interface GenerationSettings {
  mode: "image" | "video";
  model: string;
  audioOn: boolean;
  duration: string;
  quality: string;
  aspectRatio: string;
  variationCount: number;
}

interface ChatSettingsProps {
  mode: "image" | "video";
  settings: GenerationSettings;
  onSettingsChange: (settings: GenerationSettings) => void;
}

export const ChatSettings = ({
  mode,
  settings,
  onSettingsChange,
}: ChatSettingsProps) => {
  return (
    <div className="flex items-center gap-1.5 justify-end">
      <SettingDropdown
        icon={Wand2}
        label={settings.model}
        value={settings.model}
        options={["nano-banana", "nano-banana-pro"]}
        onChange={(val) => onSettingsChange({ ...settings, model: val })}
      />
      {mode === "video" && (
        <>
          <SettingDropdown
            icon={Volume2}
            label={settings.audioOn ? "Audio On" : "Audio Off"}
            value={settings.audioOn ? "On" : "Off"}
            options={["On", "Off"]}
            onChange={(val) =>
              onSettingsChange({ ...settings, audioOn: val === "On" })
            }
          />
          <SettingDropdown
            icon={Clock}
            label={settings.duration}
            value={settings.duration}
            options={["3s", "5s", "8s", "10s", "15s"]}
            onChange={(val) => onSettingsChange({ ...settings, duration: val })}
          />
          <SettingDropdown
            icon={Monitor}
            label={settings.quality}
            value={settings.quality}
            options={["SD", "HD", "1080p", "4K"]}
            onChange={(val) => onSettingsChange({ ...settings, quality: val })}
          />
        </>
      )}
      <SettingDropdown
        icon={Ratio}
        label={settings.aspectRatio}
        value={settings.aspectRatio}
        options={["16:9", "9:16", "1:1", "4:3"]}
        onChange={(val) =>
          onSettingsChange({ ...settings, aspectRatio: val })
        }
        disabled={true}
      />
      <SettingDropdown
        icon={Film}
        label={`${settings.variationCount} var${settings.variationCount === 1 ? "" : "s"}`}
        value={settings.variationCount.toString()}
        options={["1", "2", "3", "4", "5", "6"]}
        onChange={(val) =>
          onSettingsChange({
            ...settings,
            variationCount: parseInt(val),
          })
        }
        disabled={true}
      />
    </div>
  );
};

// Simple dropdown component for settings
const SettingDropdown = ({
  icon: Icon,
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#2C2D2D] border-0 text-gray-300 transition-colors text-xs whitespace-nowrap shrink-0 ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-[#252525] cursor-pointer"
        }`}
      >
        {Icon && <Icon className="w-3 h-3 shrink-0" />}
        <span className={`font-medium whitespace-nowrap ${disabled ? "text-gray-500" : "text-white"}`}>{label}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full mb-2 left-0 bg-[#1a1a1a] border border-gray-800 rounded-lg shadow-xl overflow-hidden w-48 z-20">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left hover:bg-[#252525] transition-colors text-xs whitespace-nowrap ${
                  option === value ? "bg-[#131414] text-white" : "text-gray-300"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
