"use client";

// COMMENTED OUT: OpenCut dependencies removed
// import { Suspense } from "react";
// import dynamic from "next/dynamic";
import { PageNavigation } from "@/components/redesign/PageNavigation";
import { TooltipProvider } from "@/components/ui/tooltip";

export interface OpenCutEditorShellProps {
  projectId?: string;
}

// COMMENTED OUT: OpenCut dependency removed
// const OpenCutStandaloneEditor = dynamic(
//   () => import("@opencut/app/editor/[project_id]/page"),
//   { ssr: false }
// );

export const OpenCutEditorShell = ({ projectId }: OpenCutEditorShellProps) => {
  return (
    <TooltipProvider>
      <div className="relative h-screen w-screen overflow-hidden bg-black text-white">
        <div className="flex h-full w-full items-center justify-center bg-black text-white/70">
          OpenCut editor has been disabled. Please use /editor instead.
        </div>
        {/* COMMENTED OUT: OpenCut dependency removed */}
        {/* <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-black text-white/70">
              Preparing OpenCut editor…
            </div>
          }
        >
          <OpenCutStandaloneEditor />
        </Suspense> */}
        <div className="pointer-events-none absolute top-4 left-5 z-1000">
          <div className="pointer-events-auto drop-shadow-xl">
            <PageNavigation projectId={projectId} />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default OpenCutEditorShell;
