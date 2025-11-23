"use client";

import { RemotionEditor } from "@/components/remotion/RemotionEditor";

export default function RemotionEditorPage() {
  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <header className="mb-4">
        <h1 className="text-lg font-semibold">Remotion MVP Editor</h1>
        <p className="text-sm text-muted-foreground">Declarative preview powered by Remotion Player</p>
      </header>
      <RemotionEditor />
    </div>
  );
}
