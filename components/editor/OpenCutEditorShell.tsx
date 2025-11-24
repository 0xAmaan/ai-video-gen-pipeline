"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { PageNavigation } from "@/components/redesign/PageNavigation";

const OpenCutStandaloneEditor = dynamic(
  () => import("@opencut/app/editor/[project_id]/page"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-black text-white/70">
        Loading OpenCut editor…
      </div>
    ),
  },
);

export interface OpenCutEditorShellProps {
  projectId?: string;
}

export const OpenCutEditorShell = ({ projectId }: OpenCutEditorShellProps) => {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white">
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-black text-white/70">
            Preparing OpenCut editor…
          </div>
        }
      >
        <OpenCutStandaloneEditor />
      </Suspense>

      <div className="pointer-events-none absolute top-4 right-4 z-[1000]">
        <div className="pointer-events-auto drop-shadow-xl">
          <PageNavigation projectId={projectId} />
        </div>
      </div>
    </div>
  );
};

export default OpenCutEditorShell;
