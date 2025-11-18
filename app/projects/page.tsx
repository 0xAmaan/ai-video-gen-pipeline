"use client";

import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Video, Pencil, Check, X, Trash2 } from "lucide-react";
import { useState } from "react";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const ProjectsPage = () => {
  const router = useRouter();
  const projects = useQuery(api.video.getUserProjects);
  const updateProjectTitle = useMutation(api.video.updateProjectTitle);
  const deleteProject = useMutation(api.video.deleteProject);

  const [editingId, setEditingId] = useState<Id<"videoProjects"> | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{
    id: Id<"videoProjects">;
    title: string;
  } | null>(null);

  const getProjectTitle = (project: { title?: string; prompt: string }) => {
    if (project.title) return project.title;
    return project.prompt.length > 50
      ? project.prompt.slice(0, 50) + "..."
      : project.prompt;
  };

  const startEditing = (
    e: React.MouseEvent,
    projectId: Id<"videoProjects">,
    currentTitle: string,
  ) => {
    e.stopPropagation();
    setEditingId(projectId);
    setEditingTitle(currentTitle);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditingTitle("");
  };

  const saveTitle = async (
    e: React.MouseEvent,
    projectId: Id<"videoProjects">,
  ) => {
    e.stopPropagation();
    if (editingTitle.trim()) {
      await updateProjectTitle({ projectId, title: editingTitle.trim() });
    }
    setEditingId(null);
    setEditingTitle("");
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    projectId: Id<"videoProjects">,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveTitle(e as any, projectId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing(e as any);
    }
  };

  const openDeleteDialog = (
    e: React.MouseEvent,
    projectId: Id<"videoProjects">,
    title: string,
  ) => {
    e.stopPropagation();
    setProjectToDelete({ id: projectId, title });
    setDeleteDialogOpen(true);
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    try {
      await deleteProject({ projectId: projectToDelete.id });
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (error) {
      console.error("Error deleting project:", error);
      // Optionally show an error toast here
    }
  };

  const getPhaseBadge = (lastActivePhase: string | undefined) => {
    const phaseConfig = {
      prompt: { label: "Input", color: "bg-muted text-muted-foreground" },
      storyboard: { label: "Storyboard", color: "bg-primary/30 text-primary" },
      video: { label: "Video", color: "bg-primary/60 text-primary" },
      editor: { label: "Editor", color: "bg-primary text-primary-foreground" },
    };

    const config = phaseConfig[lastActivePhase as keyof typeof phaseConfig] || {
      label: "Draft",
      color: "bg-muted text-muted-foreground",
    };

    return (
      <span
        className={`px-2.5 py-1 text-xs font-medium rounded-full ${config.color}`}
      >
        {config.label}
      </span>
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString();
    return `${dateStr} at ${timeStr}`;
  };

  return (
    <div className="min-h-screen bg-background-base">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-foreground">
            All Projects
          </h1>
        </div>

        {/* Empty State */}
        {projects?.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No projects yet. Create one to get started!
            </p>
          </div>
        )}

        {/* Project List */}
        {projects && projects.length > 0 && (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project._id}
                onClick={() => router.push(`/${project._id}/prompt`)}
                className="flex items-center gap-4 w-full p-4 bg-card hover:bg-accent rounded-lg transition-colors text-left cursor-pointer border border-border"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                  <Video className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {editingId === project._id ? (
                      <div
                        className="flex items-center gap-2 flex-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, project._id)}
                          className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                          autoFocus
                        />
                        <button
                          onClick={(e) => saveTitle(e, project._id)}
                          className="p-1 hover:bg-primary/20 rounded text-primary"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="p-1 hover:bg-destructive/20 rounded text-destructive"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-foreground font-medium truncate">
                          {getProjectTitle(project)}
                        </span>
                        <button
                          onClick={(e) =>
                            startEditing(
                              e,
                              project._id,
                              getProjectTitle(project),
                            )
                          }
                          className="p-1 hover:bg-primary/20 rounded text-muted-foreground hover:text-primary shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) =>
                            openDeleteDialog(
                              e,
                              project._id,
                              getProjectTitle(project),
                            )
                          }
                          className="p-1 hover:bg-destructive/20 rounded text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {getPhaseBadge(project.lastActivePhase)}
                      </>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(project.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{projectToDelete?.title}&quot;?
              This will permanently delete the project and all its data including
              scenes, video clips, and audio assets. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
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

export default ProjectsPage;
