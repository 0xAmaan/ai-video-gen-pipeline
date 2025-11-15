"use client";

import { useParams } from "next/navigation";
import { PhaseGuard } from "../_components/PhaseGuard";
import { useProjectData } from "../_components/useProjectData";
import { EditorPhase } from "@/components/EditorPhase";
import type { Id } from "@/convex/_generated/dataModel";

const EditorPage = () => {
  const params = useParams();
  const projectId = params?.projectId as string;

  const { clips } = useProjectData(projectId as Id<"videoProjects">);

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log("Exporting video...");
  };

  return (
    <PhaseGuard requiredPhase="editor">
      <EditorPhase clips={clips} onExport={handleExport} />
    </PhaseGuard>
  );
};

export default EditorPage;
