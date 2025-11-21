"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { DeveloperToolsMenu } from "@/components/redesign/DeveloperToolsMenu";
import { FlowVisualization } from "@/components/FlowVisualization";

export const LayoutWrapper = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  // Extract project ID from pathname (e.g., /abc123/prompt -> abc123)
  const projectIdMatch = pathname?.match(
    /^\/([^/]+)\/(prompt|storyboard|video|editor)/,
  );
  const activeProjectId = projectIdMatch ? projectIdMatch[1] : null;

  // Main flow pages (formerly redesign): clean layout with no sidebar
  const isMainFlowPage =
    pathname?.startsWith("/home") ||
    pathname?.startsWith("/input") ||
    pathname?.match(/^\/[^/]+\/(scene-planner|scene-iterator|loading|storyboard)/);

  // Archive pages: old flow with sidebar
  const isArchivePage = pathname?.startsWith("/archive");

  // Project-redesign pages: kept for backwards compatibility
  const isLegacyRedesignPage = pathname?.startsWith("/project-redesign");

  // Show sidebar only for archive pages
  const showSidebar = isSignedIn && isArchivePage;

  // Main flow pages: clean layout with dev tools
  if (isMainFlowPage || isLegacyRedesignPage) {
    return (
      <main className="h-screen overflow-auto relative">
        {children}
        <div className="fixed top-4 right-4 z-60">
          <DeveloperToolsMenu />
        </div>
        <FlowVisualization />
      </main>
    );
  }

  if (!showSidebar) {
    return (
      <>
        <main className="h-screen overflow-auto">{children}</main>
        <div className="fixed top-4 right-4 z-60">
          <DeveloperToolsMenu />
        </div>
        <FlowVisualization />
      </>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <ProjectSidebar activeProjectId={activeProjectId} />
      <main className="flex-1 overflow-auto relative">
        {children}
        <div className="fixed top-4 right-4 z-60">
          <DeveloperToolsMenu />
        </div>
        <FlowVisualization />
      </main>
    </div>
  );
};
