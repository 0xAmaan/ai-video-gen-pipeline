"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { FolderPlus, Plus, Trash2 } from "lucide-react";
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
  const [projectToDelete, setProjectToDelete] = useState<
    { id: Id<"videoProjects">; title: string } | null
  >(null);

  const sortedProjects = projects ?? [];

  const handleProjectClick = (projectId: string) => {
    router.push(`/${projectId}/scene-planner`);
  };

  if (!isSignedIn) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Please sign in to continue</p>
      </div>
    );
  }

  const openDeleteDialog = (
    e: React.MouseEvent,
    id: Id<"videoProjects">,
    title: string,
  ) => {
    e.stopPropagation();
    setProjectToDelete({ id, title });
    setDeleteDialogOpen(true);
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject({ projectId: projectToDelete.id });
    } catch (error) {
      console.error("Failed to delete project", error);
    } finally {
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  return (
    <div className="h-screen w-full bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* Hero Video Section - positioned at top */}
      <div className="w-full px-8 pt-8 shrink-0">
        <div className="relative rounded-3xl overflow-hidden shadow-2xl h-[50vh] mx-auto" style={{ maxWidth: '90vw' }}>
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
            src="/home-demo.mp4"
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
      <div className="flex-1 flex flex-col items-center px-8 pb-8">
        <div className="flex flex-col items-center gap-4 mb-8">
          {/* New Project Button */}
          <button
            onClick={() => router.push("/input")}
            className="group relative w-56 h-36 rounded-3xl bg-gray-600/60 border border-gray-500/40 hover:border-gray-400/60 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
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

          {/* Assets Button */}
          <button
            onClick={() => router.push("/assets")}
            className="group relative w-56 h-36 rounded-3xl bg-gray-600/40 border border-gray-500/30 hover:border-gray-400/60 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-500/30 flex items-center justify-center group-hover:bg-gray-400/40 transition-colors">
                <FolderPlus className="w-6 h-6 text-gray-200" />
              </div>
              <span className="text-gray-200 font-medium text-lg">
                + Assets
              </span>
            </div>
          </button>
        </div>

        <div className="w-full max-w-5xl flex-1">
          {sortedProjects.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/20 bg-white/[0.03] p-10 text-center text-gray-400">
              No projects yet. Create one to get started!
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sortedProjects.map((project) => (
                <div
                  key={project._id}
                  onClick={() => handleProjectClick(project._id)}
                  className="group relative rounded-3xl bg-gray-700/40 border border-gray-600/30 hover:border-gray-500/50 transition-all duration-300 hover:scale-[1.01] overflow-hidden cursor-pointer"
                >
                  <div className="absolute top-3 right-3 z-20 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) =>
                        openDeleteDialog(e, project._id, project.title || project.prompt.slice(0, 60))
                      }
                      className="rounded-full bg-black/60 p-2 text-gray-300 hover:text-red-300 transition"
                      title="Delete project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="relative flex h-40 flex-col justify-end p-5">
                    <p className="text-white font-medium text-lg line-clamp-2">
                      {project.title || project.prompt.slice(0, 80)}
                    </p>
                    <p className="text-gray-300 text-xs mt-2">
                      Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{projectToDelete?.title}&quot;
              and all related scenes, clips, and assets.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProject}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomePage;
