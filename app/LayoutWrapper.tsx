"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { DeveloperToolsMenu } from "@/components/DeveloperToolsMenu";
import { FlowVisualization } from "@/components/FlowVisualization";

export const LayoutWrapper = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  // Extract project ID from pathname (e.g., /abc123/prompt -> abc123)
  const projectIdMatch = pathname?.match(
    /^\/([^/]+)\/(prompt|storyboard|video|editor)/,
  );
  const activeProjectId = projectIdMatch ? projectIdMatch[1] : null;

  // Don't show sidebar on home login page or if not signed in
  const showSidebar = isSignedIn && pathname !== "/";

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
