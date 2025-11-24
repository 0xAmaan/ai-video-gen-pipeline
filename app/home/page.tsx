"use client";

import { useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, type Doc } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const HomePage = () => {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const projects = useQuery(
    api.video.getUserProjects,
    isSignedIn ? {} : "skip",
  );
  const deleteProject = useMutation(api.video.deleteProject);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{
    id: Id<"videoProjects">;
    title: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const projectList = projects || [];

  const getProjectTitle = (project: { title?: string; prompt: string }) => {
    if (project.title) return project.title;
    return project.prompt.length > 60
      ? project.prompt.slice(0, 60) + "..."
      : project.prompt;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/${projectId}/scene-planner`);
  };

  const handleDeleteClick = (
    e: MouseEvent,
    projectId: Id<"videoProjects">,
    title: string,
  ) => {
    e.stopPropagation();
    setProjectToDelete({ id: projectId, title });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;

    try {
      setIsDeleting(true);
      await deleteProject({ projectId: projectToDelete.id });
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (error) {
      console.error("Error deleting project:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isSignedIn) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Please sign in to continue</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] flex flex-col overflow-y-auto">
      {/* Hero Video Section - positioned at top */}
      <div className="w-full px-8 pt-8 shrink-0">
        <div
          className="relative rounded-3xl overflow-hidden shadow-2xl h-[50vh] mx-auto"
          style={{ maxWidth: "90vw" }}
        >
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
            src="/home-demo.mov"
          />
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Text overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
            <h1 className="text-5xl font-semibold text-white mb-3">
              Turn your ideas into reality
            </h1>
            <p className="text-xl text-gray-200">
              Get started by creating a project
            </p>
          </div>
        </div>
      </div>

      {/* Projects Section - centered with more margin from hero */}
      <div className="flex-1 w-full px-8 pb-12 pt-16">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 auto-rows-[180px]">
            {/* New Project Button */}
            <button
              onClick={() => router.push("/input")}
              className="group relative rounded-3xl bg-gray-600/60 border border-gray-500/40 hover:border-gray-400/60 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-500/40 flex items-center justify-center group-hover:bg-gray-400/50 transition-colors">
                  <Plus className="w-6 h-6 text-gray-200" />
                </div>
                <span className="text-gray-200 font-medium text-lg">
                  New project
                </span>
              </div>
            </button>

            {/* All Projects */}
            {projectList.map((project) => (
              <ProjectPreviewCard
                key={project._id}
                project={project}
                getProjectTitle={getProjectTitle}
                formatDate={formatDate}
                handleProjectClick={handleProjectClick}
                handleDeleteClick={handleDeleteClick}
              />
            ))}
          </div>

          {projectList.length === 0 && (
            <p className="text-center text-sm text-gray-400">
              You don&apos;t have any projects yet. Create one to get started.
            </p>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{projectToDelete?.title}&quot;
              and all related scenes, clips, and assets. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteProject}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

type ProjectDoc = Doc<"videoProjects">;

type ProjectPreviewCardProps = {
  project: ProjectDoc;
  getProjectTitle: (project: ProjectDoc) => string;
  formatDate: (timestamp: number) => string;
  handleProjectClick: (projectId: string) => void;
  handleDeleteClick: (
    e: MouseEvent,
    projectId: Id<"videoProjects">,
    title: string,
  ) => void;
};

const ProjectPreviewCard = ({
  project,
  getProjectTitle,
  formatDate,
  handleProjectClick,
  handleDeleteClick,
}: ProjectPreviewCardProps) => {
  const scenes = useQuery(api.video.getScenes, { projectId: project._id });
  const videoClips = useQuery(api.video.getVideoClips, {
    projectId: project._id,
  });
  const finalVideo = useQuery(api.video.getFinalVideo, {
    projectId: project._id,
  });

  const previewImage =
    scenes && scenes.length > 0
      ? (scenes[0].imageUrl ?? project.referenceImageUrl ?? null)
      : (project.referenceImageUrl ?? null);

  const clipWithVideo =
    videoClips?.find(
      (clip) =>
        clip.status === "complete" &&
        (clip.lipsyncVideoUrl ||
          clip.proxyUrl ||
          clip.videoUrl ||
          clip.sourceUrl),
    ) ?? null;

  const clipVideoUrl =
    clipWithVideo?.lipsyncVideoUrl ??
    clipWithVideo?.proxyUrl ??
    clipWithVideo?.videoUrl ??
    clipWithVideo?.sourceUrl ??
    null;

  const sceneVideoUrl =
    scenes?.find((scene) => !!scene.lipsyncVideoUrl)?.lipsyncVideoUrl ?? null;

  const finalVideoUrl =
    finalVideo && finalVideo.videoUrl && finalVideo.status === "complete"
      ? finalVideo.videoUrl
      : null;

  const previewVideoUrl =
    finalVideoUrl || clipVideoUrl || sceneVideoUrl || null;

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleMouseEnter = () => {
    if (previewVideoUrl && videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play().catch(() => undefined);
    }
  };

  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          handleProjectClick(project._id);
        }
      }}
      onClick={() => handleProjectClick(project._id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group relative rounded-3xl bg-gray-800/60 border border-gray-600/30 hover:border-gray-500/60 transition-all duration-300 hover:scale-[1.01] overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {previewImage && (
        <img
          src={previewImage}
          alt={getProjectTitle(project)}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          draggable={false}
        />
      )}

      {!previewImage && (
        <div className="absolute inset-0 bg-gradient-to-b from-gray-700/40 to-gray-900/80" />
      )}

      {previewVideoUrl && (
        <video
          ref={videoRef}
          src={previewVideoUrl}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        />
      )}

      <button
        onClick={(e) =>
          handleDeleteClick(e, project._id, getProjectTitle(project))
        }
        className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/70 border border-white/10 flex items-center justify-center text-gray-300 hover:text-destructive hover:border-destructive/60 transition-all opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
        aria-label="Delete project"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      <div className="absolute inset-0 flex flex-col items-center justify-end p-5 z-10 pointer-events-none">
        <p className="text-white font-medium text-center line-clamp-2 text-sm">
          {getProjectTitle(project)}
        </p>
        <p className="text-gray-300 text-xs mt-1">
          {formatDate(project.updatedAt)}
        </p>
      </div>
    </div>
  );
};

export default HomePage;
