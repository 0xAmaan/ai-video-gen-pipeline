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

  const handleCreate = async () => {
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
        prompt: initialIdeas.trim() || title.trim(), // Use title as fallback prompt
        promptPlannerData: initialIdeas.trim() || undefined,
      });

      toast.success("Project created!");
      onOpenChange(false);

      // Navigate to the new project's scene planner immediately
      router.push(`/project-redesign/${projectId}/scene-planner`);

      // If user provided initial ideas, trigger AI scene generation in the background
      if (initialIdeas.trim()) {
        // Fire and forget - the scene planner will show loading state and populate when done
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
      <DialogContent className="sm:max-w-[540px] border-gray-800/50 bg-[#0f0f0f] p-0 gap-0">
        <div className="px-7 pt-7 pb-6">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-semibold text-white">
              Create New Project
            </DialogTitle>
            <DialogDescription className="text-gray-400 text-[15px]">
              Give your project a name and optionally jot down some initial ideas.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-7 pb-7 space-y-6">
          <div className="space-y-3">
            <Label htmlFor="title" className="text-sm font-medium text-gray-300 mb-1 block">
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
                  handleCreate();
                }
              }}
              className="w-full px-4 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-gray-500 text-[15px] transition-colors focus:outline-none focus:border-white/20 focus:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus
              disabled={isCreating}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="ideas" className="text-sm font-medium text-gray-300 mb-1 block">
              Initial Ideas <span className="text-gray-500">(Optional)</span>
            </Label>
            <textarea
              id="ideas"
              placeholder="Jot down any initial thoughts, script ideas, or notes for this project..."
              value={initialIdeas}
              onChange={(e) => setInitialIdeas(e.target.value)}
              className="w-full min-h-[120px] px-4 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white placeholder:text-gray-500 text-[15px] resize-none transition-colors focus:outline-none focus:border-white/20 focus:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isCreating}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
              className="px-4 py-2 border-white/10 hover:bg-white/5 hover:border-white/20 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
