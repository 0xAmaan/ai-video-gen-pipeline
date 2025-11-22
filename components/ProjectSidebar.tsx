"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { UserButton } from "@clerk/nextjs";
import { PanelLeftClose, PanelLeftOpen, FolderOpen, FolderPlus } from "lucide-react";
import { NewProjectButton } from "./NewProjectButton";
import { useKeyboardShortcut } from "@/hooks/useKeyboardShortcut";
import type { Id } from "@/convex/_generated/dataModel";

interface ProjectSidebarProps {
  activeProjectId: string | null;
}

export const ProjectSidebar = ({ activeProjectId }: ProjectSidebarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const projects = useQuery(api.video.getUserProjects);
  const recentProjects = projects?.slice(0, 10) || [];

  // Check if clips are currently generating for active project
  const isGenerating = useQuery(
    api.video.areClipsGenerating,
    activeProjectId
      ? { projectId: activeProjectId as Id<"videoProjects"> }
      : "skip",
  );

  // Hydration-safe localStorage
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved !== null) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("sidebarCollapsed", JSON.stringify(isCollapsed));
    }
  }, [isCollapsed, isMounted]);

  // Keyboard shortcut: Cmd+. or Ctrl+.
  useKeyboardShortcut(".", () => setIsCollapsed((prev) => !prev), true);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  const getProjectTitle = (prompt: string) => {
    return prompt.length > 50 ? prompt.slice(0, 50) + "..." : prompt;
  };

  const isProjectActive = (projectId: string) => {
    return activeProjectId === projectId;
  };

  const handleProjectClick = (projectId: string) => {
    // Prevent navigation if clips are currently generating
    if (isGenerating) {
      return;
    }
    router.push(`/${projectId}/prompt`);
  };

  const handleProjectsClick = () => {
    // Prevent navigation if clips are currently generating
    if (isGenerating) {
      return;
    }
    router.push("/projects");
  };

  const handleAssetsClick = () => {
    if (isGenerating) {
      return;
    }
    router.push("/assets");
  };

  return (
    <div
      className={`h-screen bg-card border-r border-border flex flex-col transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-80"
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 py-5 border-b border-border flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}
      >
        {!isCollapsed && (
          <button
            onClick={() => router.push("/")}
            className="text-lg font-semibold text-foreground hover:text-primary transition-colors truncate cursor-pointer"
          >
            Video Pipeline
          </button>
        )}
        <button
          onClick={handleToggleCollapse}
          className="p-2 rounded-lg hover:bg-accent transition-colors shrink-0 cursor-pointer"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-5 h-5 text-muted-foreground" />
          ) : (
            <PanelLeftClose className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {/* New Project Button */}
        <div className="mb-3">
          <NewProjectButton isCollapsed={isCollapsed} disabled={isGenerating} />
        </div>

        {/* Projects Button */}
        <button
          onClick={handleProjectsClick}
          disabled={isGenerating}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors mb-4 ${
            isGenerating
              ? "opacity-50 cursor-not-allowed"
              : "cursor-pointer " +
                (pathname === "/projects"
                  ? "bg-accent text-foreground"
                  : "text-foreground hover:bg-accent")
          }`}
          title={isCollapsed ? "All Projects" : undefined}
        >
          <FolderOpen className="w-5 h-5 shrink-0" />
          {!isCollapsed && (
            <span className="text-sm font-medium">Projects</span>
          )}
        </button>

        {/* Assets Button */}
        <button
          onClick={handleAssetsClick}
          disabled={isGenerating}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors mb-6 ${
            isGenerating
              ? "opacity-50 cursor-not-allowed"
              : "cursor-pointer " +
                (pathname === "/assets"
                  ? "bg-accent text-foreground"
                  : "text-foreground hover:bg-accent")
          }`}
          title={isCollapsed ? "Brand Assets" : undefined}
        >
          <FolderPlus className="w-5 h-5 shrink-0" />
          {!isCollapsed && (
            <span className="text-sm font-medium">Assets</span>
          )}
        </button>

        {/* Recents Section */}
        {!isCollapsed && recentProjects.length > 0 && (
          <div>
            <div className="px-3 pb-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground/60 font-semibold">
                Recent
              </span>
            </div>
            <div className="space-y-1">
              {recentProjects.map((project) => (
                <button
                  key={project._id}
                  onClick={() => handleProjectClick(project._id)}
                  disabled={isGenerating}
                  className={`flex flex-col gap-1 w-full px-3 py-2.5 rounded-lg transition-all text-left ${
                    isGenerating
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer " +
                        (isProjectActive(project._id)
                          ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                          : "text-foreground/80 hover:bg-accent hover:text-foreground")
                  }`}
                  title={project.prompt}
                >
                  <span className="text-sm font-medium truncate leading-tight">
                    {getProjectTitle(project.prompt)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(project.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User Button - Fixed at bottom */}
      <div
        className={`p-4 border-t border-border ${isCollapsed ? "flex justify-center" : ""}`}
      >
        <UserButton afterSignOutUrl="/" />
      </div>
    </div>
  );
};
