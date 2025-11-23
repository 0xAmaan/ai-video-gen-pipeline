"use client";

import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";

type Phase =
  | "prompt"
  | "character-select"
  | "storyboard"
  | "video"
  | "audio"
  | "editor";

const PhaseIndicator = () => {
  const params = useParams();
  const pathname = usePathname();
  const projectId = params?.projectId as string;

  const phases: { id: Phase; label: string; path: string }[] = [
    { id: "prompt", label: "Input", path: `/${projectId}/prompt` },
    {
      id: "character-select",
      label: "Character",
      path: `/${projectId}/character-select`,
    },
    { id: "storyboard", label: "Storyboard", path: `/${projectId}/storyboard` },
    { id: "video", label: "Video", path: `/${projectId}/video` },
    { id: "audio", label: "Audio", path: `/${projectId}/audio` },
    { id: "editor", label: "Edit", path: `/${projectId}/editor` },
  ];

  const currentPhaseIndex = phases.findIndex((p) => pathname?.includes(p.id));

  return (
    <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-5">
        <div className="flex items-center justify-center gap-2">
          {phases.map((phase, index) => (
            <div key={phase.id} className="flex items-center">
              <Link
                href={phase.path}
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                    index < currentPhaseIndex
                      ? "bg-primary border-primary text-primary-foreground"
                      : index === currentPhaseIndex
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {index < currentPhaseIndex ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    index === currentPhaseIndex
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {phase.label}
                </span>
              </Link>
              {index < phases.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 ${
                    index < currentPhaseIndex ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ProjectLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const isEditor = pathname?.endsWith("/editor");
  const isCharacterSelect = pathname?.includes("/character-select");

  // Editor needs full-screen layout without nav or container constraints
  if (isEditor) {
    return <div className="h-screen bg-background-base">{children}</div>;
  }

  // Character-select keeps nav but removes container constraints for full-width
  if (isCharacterSelect) {
    return (
      <div className="min-h-screen bg-background-base">
        <PhaseIndicator />
        {children}
      </div>
    );
  }

  // Other phases use centered container layout
  return (
    <div className="min-h-screen bg-background-base">
      <PhaseIndicator />
      <div className="container mx-auto px-4 py-8">{children}</div>
    </div>
  );
};

export default ProjectLayout;
