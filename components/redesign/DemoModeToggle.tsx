"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Zap, DollarSign, Sparkles } from "lucide-react";
import { getDemoMode, setDemoMode, initDemoMode, isDevelopment, type DemoMode } from "@/lib/demo-mode";

export const DemoModeToggle = () => {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<DemoMode>("off");

  useEffect(() => {
    setMounted(true);
    initDemoMode();
    setMode(getDemoMode());
  }, []);

  const handleModeChange = (newMode: DemoMode) => {
    setDemoMode(newMode);
    setMode(newMode);

    // Log to console for feedback
    console.log(`[Demo Mode] Switched to: ${newMode}`);

    // Show a visual confirmation
    if (typeof window !== 'undefined') {
      const modeLabels = {
        off: 'Off (Normal)',
        'no-cost': 'No-Cost (Mock Data)',
        cheap: 'Cheap Inference',
        real: 'Real (Production)'
      };
      console.log(`[Demo Mode] Active: ${modeLabels[newMode]}`);
    }
  };

  // Only render in development
  if (!mounted || !isDevelopment()) {
    return null;
  }

  const getModeConfig = (m: DemoMode) => {
    switch (m) {
      case "no-cost":
        return {
          label: "No-Cost (Mock)",
          icon: Zap,
          color: "bg-green-500/20 text-green-600 border-green-500/30",
          description: "Instant mock responses, zero API costs",
        };
      case "cheap":
        return {
          label: "Cheap Inference",
          icon: DollarSign,
          color: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
          description: "Fastest/cheapest models for real inference",
        };
      case "real":
        return {
          label: "Real (Production)",
          icon: Sparkles,
          color: "bg-blue-500/20 text-blue-600 border-blue-500/30",
          description: "Production-quality models",
        };
      default:
        return {
          label: "Off",
          icon: Settings,
          color: "bg-muted text-muted-foreground border-border",
          description: "Normal mode",
        };
    }
  };

  const currentConfig = getModeConfig(mode);
  const Icon = currentConfig.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 ${mode !== "off" ? currentConfig.color : ""} border`}
        >
          <Icon className="w-4 h-4" />
          <span className="hidden sm:inline">{currentConfig.label}</span>
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
            DEV
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 border-border/50">
        <div className="text-center py-2">
          <DropdownMenuLabel className="text-base">Demo Mode</DropdownMenuLabel>
          <p className="text-xs text-muted-foreground px-2">
            Testing modes for development only
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={mode} onValueChange={(v) => handleModeChange(v as DemoMode)}>
          <DropdownMenuRadioItem value="off" className="cursor-pointer">
            <div className="flex flex-col gap-1 py-1">
              <span className="font-medium">Off</span>
              <span className="text-xs text-muted-foreground">
                Normal production behavior
              </span>
            </div>
          </DropdownMenuRadioItem>

          <DropdownMenuRadioItem value="no-cost" className="cursor-pointer">
            <div className="flex flex-col gap-1 py-1">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-600" />
                <span className="font-medium">No-Cost (Mock Data)</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Instant mock responses • Zero API costs • Perfect for rapid testing
              </span>
            </div>
          </DropdownMenuRadioItem>

          <DropdownMenuRadioItem value="cheap" className="cursor-pointer">
            <div className="flex flex-col gap-1 py-1">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-yellow-600" />
                <span className="font-medium">Cheap Inference</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Fastest/cheapest models • Real API calls • ~50% cost reduction
              </span>
            </div>
          </DropdownMenuRadioItem>

          <DropdownMenuRadioItem value="real" className="cursor-pointer">
            <div className="flex flex-col gap-1 py-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Real (Production)</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Production-quality models • Full cost • Best results
              </span>
            </div>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        {mode !== "off" && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-2 text-xs text-muted-foreground text-center">
              <p className="font-medium mb-1">Current Mode:</p>
              <p>{currentConfig.description}</p>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
