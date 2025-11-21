"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Film } from "lucide-react";

import { Id } from "@/convex/_generated/dataModel";
import { PageNavigation } from "@/components/redesign/PageNavigation";
import { StoryboardSceneRow } from "@/components/redesign/StoryboardSceneRow";
import { VerticalMediaGallery } from "@/components/redesign/VerticalMediaGallery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useAllMasterShotsSet,
  useProjectProgress,
  useStoryboardRows,
} from "@/lib/hooks/useProjectRedesign";
import { ShotSelectionSummary } from "@/lib/types/redesign";

const StoryboardPage = () => {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params?.projectId as Id<"videoProjects"> | undefined;

  const storyboardRows = useStoryboardRows(projectId);
  const progress = useProjectProgress(projectId);
  const allMasterShotsSet = useAllMasterShotsSet(projectId);

  const [selectedSceneId, setSelectedSceneId] = useState<Id<"projectScenes"> | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<Id<"sceneShots"> | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!storyboardRows?.length) return;

    if (!selectedSceneId) {
      setSelectedSceneId(storyboardRows[0].scene._id);
    }

    if (!selectedShotId) {
      const firstShot = storyboardRows[0].shots[0]?.shot._id;
      if (firstShot) setSelectedShotId(firstShot);
    }
  }, [storyboardRows, selectedSceneId, selectedShotId]);

  const scenesForGallery = useMemo(
    () =>
      storyboardRows?.map((row) => ({
        ...row.scene,
        shots: row.shots.map((shotData) => shotData.shot),
      })) ?? [],
    [storyboardRows],
  );

  const scrollToScene = (sceneId: Id<"projectScenes">) => {
    const node = rowRefs.current[sceneId];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSceneSelect = (sceneId: Id<"projectScenes">) => {
    setSelectedSceneId(sceneId);
    scrollToScene(sceneId);
  };

  const handleShotSelect = (shotId: Id<"sceneShots">) => {
    setSelectedShotId(shotId);
    const owningRow = storyboardRows?.find((row) =>
      row.shots.some((shotData) => shotData.shot._id === shotId),
    );
    if (owningRow) {
      setSelectedSceneId(owningRow.scene._id);
      scrollToScene(owningRow.scene._id);
    }
  };

  const handleGallerySelect = (selection: ShotSelectionSummary) => {
    setSelectedShotId(selection.shot._id);
    setSelectedSceneId(selection.scene._id);
    scrollToScene(selection.scene._id);
  };

  const totalShots = progress?.totalShots ?? 0;
  const shotsWithSelections = progress?.shotsWithSelections ?? 0;
  const selectionProgress = totalShots > 0 ? Math.round((shotsWithSelections / totalShots) * 100) : 0;

  return (
    <div className="min-h-screen w-full bg-[var(--bg-base)] text-white">
      <div className="border-b border-white/10 bg-[var(--bg-base)]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center gap-8">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.12em] text-gray-500 mb-1">Storyboard</p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">Finalise your master shots</h1>
              {selectionProgress > 0 && (
                <Badge variant="secondary" className="bg-blue-500/15 text-blue-200 border-blue-500/30">
                  {selectionProgress}% selected
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Review every scene, lock your chosen frames, and move into the editor once you are ready.
            </p>
          </div>

          <div className="flex-1 flex justify-center">
            <PageNavigation
              projectId={projectId}
              storyboardLocked={!allMasterShotsSet}
              storyboardLockMessage="Set master shots in Scene Planner before animating the storyboard."
            />
          </div>

          <div className="flex-1 flex justify-end">
            <Button
              variant="secondary"
              onClick={() => projectId && router.push(`/${projectId}/editor`)}
              disabled={!allMasterShotsSet}
              className="gap-2"
            >
              <Film className="w-4 h-4" />
              Open editor
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-10 flex gap-8">
        <div className="flex-1 space-y-6">
          {!storyboardRows ? (
            <div className="space-y-4">
              <div className="h-4 w-40 bg-white/5 rounded-md animate-pulse" />
              <div className="h-48 w-full bg-white/5 rounded-3xl animate-pulse" />
              <div className="h-48 w-full bg-white/5 rounded-3xl animate-pulse" />
            </div>
          ) : storyboardRows.length === 0 ? (
            <div className="border border-dashed border-gray-700 rounded-3xl p-10 text-center">
              <p className="text-gray-300 font-medium mb-2">No storyboard shots yet.</p>
              <p className="text-gray-500 text-sm mb-4">
                Head back to the Scene Planner to pick master shots, then return here to review them.
              </p>
              <Button variant="outline" onClick={() => projectId && router.push(`/${projectId}/scene-planner`)}>
                Go to Scene Planner
              </Button>
            </div>
          ) : (
            storyboardRows.map((row) => (
              <div
                key={row.scene._id}
                ref={(node) => {
                  rowRefs.current[row.scene._id] = node;
                }}
                className="scroll-mt-24"
              >
                <StoryboardSceneRow
                  scene={row}
                  isSelected={selectedSceneId === row.scene._id}
                  selectedShotId={selectedShotId}
                  onSceneSelect={handleSceneSelect}
                  onShotSelect={handleShotSelect}
                />
              </div>
            ))
          )}
        </div>

        <div className="hidden xl:block w-72 flex-shrink-0">
          <VerticalMediaGallery
            projectId={projectId}
            scenes={scenesForGallery}
            activeShotId={selectedShotId}
            onSelect={handleGallerySelect}
          />
        </div>
      </div>
    </div>
  );
};

export default StoryboardPage;

