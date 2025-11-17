"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useModelStore, useModelSelectionEnabled } from "@/lib/stores/modelStore";
import { Settings, Zap } from "lucide-react";

export function ModelSelectorToggle() {
  const modelSelectionEnabled = useModelSelectionEnabled();
  const setModelSelectionEnabled = useModelStore((state) => state.setModelSelectionEnabled);

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="flex flex-row items-center space-y-0 pb-3">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-lg">Developer Settings</CardTitle>
        </div>
        {modelSelectionEnabled && (
          <Badge variant="secondary" className="ml-auto">
            <Zap className="w-3 h-3 mr-1" />
            Active
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between space-x-2">
          <div className="space-y-0.5">
            <Label htmlFor="model-selection-toggle" className="text-base font-medium">
              Model Selection
            </Label>
            <p className="text-sm text-muted-foreground">
              Enable dropdown menus to select different AI models for each step of the pipeline
            </p>
          </div>
          <Switch
            id="model-selection-toggle"
            checked={modelSelectionEnabled}
            onCheckedChange={setModelSelectionEnabled}
          />
        </div>

        {modelSelectionEnabled && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 rounded">
              <strong>Note:</strong> Model selection dropdowns will appear before each AI processing step.
              Changes will apply to new generations only.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}