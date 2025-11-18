"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageNavigation } from "@/components/redesign/PageNavigation";
import { StoryboardSceneRow } from "@/components/redesign/StoryboardSceneRow";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { useStoryboardRows } from "@/lib/hooks/useProjectRedesign";

const StoryboardPage = () => {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params?.projectId as Id<"videoProjects"> | undefined;
  const storyboardRows = useStoryboardRows(projectId);

  const [selectedSceneId, setSelectedSceneId] = useState<
    Id<"projectScenes"> | null
  >(null);
  const [selectedShotId, setSelectedShotId] = useState<
    Id<"sceneShots"> | null
  >(null);

  useEffect(() => {
    if (storyboardRows && storyboardRows.length > 0) {
      setSelectedSceneId((prev) => prev ?? storyboardRows[0].scene._id);
    }
  }, [storyboardRows]);

  if (!projectId) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Missing project context.
      </div>
    );
  }

  const hasRows = !!storyboardRows && storyboardRows.length > 0;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-sm border-b border-gray-900 px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">
              Storyboard
            </p>
            <h1 className="text-2xl font-bold">Selected master shots</h1>
            <p className="text-sm text-gray-400 mt-1">
              Review each scene&apos;s chosen frames before animation.
            </p>
          </div>

          <PageNavigation projectId={projectId} />

          <Button
            variant="outline"
            className="border-gray-700 text-gray-200 hover:bg-gray-800"
            onClick={() =>
              router.push(`/project-redesign/${projectId}/scene-planner`)
            }
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Planner
          </Button>
        </div>
      </div>

      <div className="px-8 py-8 space-y-4">
        {!storyboardRows ? (
          <div className="text-gray-500 text-center py-20 border border-dashed border-gray-800 rounded-3xl">
            Loading storyboard...
          </div>
        ) : !hasRows ? (
          <div className="text-gray-500 text-center py-20 border border-dashed border-gray-800 rounded-3xl">
            No storyboard selections yet. Select master shots in the iterator to
            populate this view.
          </div>
        ) : (
          storyboardRows.map((row) => (
            <StoryboardSceneRow
              key={row.scene._id}
              scene={row}
              isSelected={selectedSceneId === row.scene._id}
              selectedShotId={selectedShotId}
              onSceneSelect={(sceneId) => setSelectedSceneId(sceneId)}
              onShotSelect={(shotId) => setSelectedShotId(shotId)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default StoryboardPage;
