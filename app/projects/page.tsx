"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Video } from "lucide-react";

const ProjectsPage = () => {
  const router = useRouter();
  const projects = useQuery(api.video.getUserProjects);

  const getProjectTitle = (prompt: string) => {
    return prompt.length > 50 ? prompt.slice(0, 50) + "..." : prompt;
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
              <button
                key={project._id}
                onClick={() => router.push(`/${project._id}/prompt`)}
                className="flex items-center gap-4 w-full p-4 bg-card hover:bg-accent rounded-lg transition-colors text-left cursor-pointer border border-border"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
                  <Video className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-foreground font-medium truncate">
                      {getProjectTitle(project.prompt)}
                    </span>
                    {getPhaseBadge(project.lastActivePhase)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(project.createdAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsPage;
