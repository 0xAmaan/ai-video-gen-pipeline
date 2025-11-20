"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Plus } from "lucide-react";

const HomePage = () => {
  const router = useRouter();
  const { isSignedIn, userId } = useAuth();
  const projects = useQuery(
    api.video.getUserProjects,
    isSignedIn ? {} : "skip",
  );

  // Get 3 most recent projects
  const recentProjects = projects?.slice(0, 3) || [];

  const handleProjectClick = (projectId: string) => {
    router.push(`/project-redesign/${projectId}/scene-planner`);
  };

  if (!isSignedIn) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Please sign in to continue</p>
      </div>
    );
  }

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
      <div className="flex-1 flex items-center justify-center px-8 pb-8">
        <div className="flex flex-wrap items-center justify-center gap-5 max-w-5xl">
          {/* New Project Button */}
          <button
            onClick={() => router.push("/project-redesign/input")}
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

          {/* Recent Projects */}
          {recentProjects.map((project) => (
            <button
              key={project._id}
              onClick={() => handleProjectClick(project._id)}
              className="group relative w-56 h-36 rounded-3xl bg-gray-700/40 border border-gray-600/30 hover:border-gray-500/50 transition-all duration-300 hover:scale-[1.02] overflow-hidden cursor-pointer"
            >
              {/* Project info overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-end p-5 bg-gradient-to-t from-black/50 via-transparent to-transparent">
                <p className="text-white font-medium text-center line-clamp-2 text-sm">
                  {project.title || project.prompt.slice(0, 50)}
                </p>
                <p className="text-gray-300 text-xs mt-1">
                  {new Date(project.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
