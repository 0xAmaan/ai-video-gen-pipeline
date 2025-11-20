"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCreateRedesignProject } from "@/lib/hooks/useProjectRedesign";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NewProjectDialog = ({ open, onOpenChange }: NewProjectDialogProps) => {
  const [title, setTitle] = useState("");
  const [initialIdeas, setInitialIdeas] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const { userId } = useAuth();
  const createProject = useCreateRedesignProject();

  const createNewProject = async () => {
    if (!title.trim()) {
      toast.error("Please enter a project title");
      return;
    }

    if (!userId) {
      toast.error("You must be signed in to create a project");
      return;
    }

    setIsCreating(true);
    try {
      const projectId = await createProject({
        userId,
        title: title.trim(),
        prompt: initialIdeas.trim() || title.trim(),
        promptPlannerData: initialIdeas.trim() || undefined,
      });

      toast.success("Project created!");
      onOpenChange(false);

      router.push(`/project-redesign/${projectId}/scene-planner`);

      if (initialIdeas.trim()) {
        fetch("/api/project-redesign/generate-scenes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            userInput: initialIdeas.trim(),
            projectTitle: title.trim(),
          }),
        }).catch((error) => {
          console.error("Background scene generation failed:", error);
        });
      }
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error("Failed to create project. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isCreating) {
      onOpenChange(newOpen);
      // Reset form when closing
      if (!newOpen) {
        setTitle("");
        setInitialIdeas("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px] border-gray-800/50 bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-surface-dark)] p-0 gap-0 shadow-2xl">
        <div className="px-8 pt-8 pb-6">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <DialogTitle className="text-2xl font-bold text-white">
                Create New Project
              </DialogTitle>
            </div>
            <DialogDescription className="text-gray-400 text-base leading-relaxed">
              Give your project a name and optionally jot down some initial ideas to get started with AI-powered scene generation.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-8 pb-8 space-y-6">
          <div className="space-y-3">
            <Label htmlFor="title" className="text-sm font-medium text-gray-300 mb-1.5 block">
              Project Title <span className="text-red-400">*</span>
            </Label>
            <input
              id="title"
              type="text"
              placeholder="My Awesome Video"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  createNewProject();
                }
              }}
              className="w-full px-4 py-3 bg-[var(--bg-base)] border border-gray-700 rounded-xl text-white placeholder:text-gray-500 text-base transition-all focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus
              disabled={isCreating}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="ideas" className="text-sm font-medium text-gray-300 mb-1.5 block">
              Initial Ideas <span className="text-gray-500">(Optional)</span>
            </Label>
            <textarea
              id="ideas"
              placeholder="Jot down any initial thoughts, script ideas, or notes for this project..."
              value={initialIdeas}
              onChange={(e) => setInitialIdeas(e.target.value)}
              className="w-full min-h-[140px] px-4 py-3 bg-[var(--bg-base)] border border-gray-700 rounded-xl text-white placeholder:text-gray-500 text-base resize-none transition-all focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isCreating}
            />
            <p className="text-xs text-gray-500">
              💡 Tip: Add initial ideas to generate AI-powered scene breakdowns automatically
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
              className="px-5 py-2.5 border-gray-700 hover:bg-gray-800 hover:border-gray-600 text-gray-300 transition-all"
            >
              Cancel
            </Button>
            <Button
              onClick={createNewProject}
              disabled={isCreating || !title.trim()}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold disabled:opacity-50 shadow-lg shadow-primary/20 transition-all hover:scale-105"
            >
              {isCreating ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
