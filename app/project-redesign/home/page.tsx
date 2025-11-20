"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Plus, Sparkles, Clock, Search } from "lucide-react";
import { NewProjectDialog } from "@/components/NewProjectDialog";
import { Input } from "@/components/ui/input";

const HomePage = () => {
  const router = useRouter();
  const { isSignedIn, userId } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const projects = useQuery(
    api.video.getUserProjects,
    isSignedIn ? {} : "skip",
  );

  // Filter projects based on search
  const filteredProjects = projects?.filter((project) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      project.title?.toLowerCase().includes(searchLower) ||
      project.prompt.toLowerCase().includes(searchLower)
    );
  }) || [];

  // Get 6 most recent projects (increased from 3)
  const recentProjects = filteredProjects.slice(0, 6);

  if (!isSignedIn) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Please sign in to continue</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[var(--bg-base)] flex flex-col overflow-hidden">
      {/* Hero Video Section */}
      <div className="w-full px-8 pt-8 shrink-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl overflow-hidden shadow-2xl h-[45vh] mx-auto group"
          style={{ maxWidth: '90vw' }}
        >
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            src="/home-demo.mp4"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Text overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="space-y-3"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-white">
                  AI-Powered Video Creation
                </span>
              </div>
              <h1 className="text-5xl font-bold text-white mb-3 drop-shadow-lg">
                Turn your ideas into reality
              </h1>
              <p className="text-xl text-gray-100">
                Get started by creating a project
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Projects Section */}
      <div className="flex-1 flex flex-col items-center px-8 py-8 overflow-auto">
        <div className="w-full max-w-6xl space-y-6">
          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-4"
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <Input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[var(--bg-surface)] border-gray-700 focus-visible:border-primary text-white placeholder:text-gray-500"
              />
            </div>
          </motion.div>

          {/* Projects Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* New Project Card */}
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() => setIsDialogOpen(true)}
              className="group relative h-48 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-600/20 border-2 border-dashed border-primary/40 hover:border-primary/60 transition-all duration-300 hover:scale-105 cursor-pointer overflow-hidden"
            >
              {/* Animated gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative h-full flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-all duration-300 group-hover:scale-110">
                  <Plus className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-1">
                  <span className="text-white font-semibold text-lg block">
                    New Project
                  </span>
                  <span className="text-gray-400 text-sm">
                    Start creating
                  </span>
                </div>
              </div>
            </motion.button>

            {/* Recent Project Cards */}
            {recentProjects.map((project, index) => (
              <motion.button
                key={project._id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + (index + 1) * 0.05 }}
                onClick={() => router.push(`/project-redesign/${project._id}/scene-planner`)}
                className="group relative h-48 rounded-2xl bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-surface-dark)] border border-gray-700/50 hover:border-primary/50 transition-all duration-300 hover:scale-105 overflow-hidden cursor-pointer"
              >
                {/* Thumbnail/Background - could be enhanced with actual project thumbnails */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-800/30 to-gray-900/50" />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-100 group-hover:opacity-90 transition-opacity" />

                {/* Content */}
                <div className="relative h-full flex flex-col justify-between p-6">
                  {/* Top: Project icon */}
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div className="px-2.5 py-1 rounded-full bg-gray-800/80 backdrop-blur-sm border border-gray-700">
                      <span className="text-xs text-gray-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(project.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Bottom: Project info */}
                  <div className="space-y-2">
                    <h3 className="text-white font-semibold text-lg line-clamp-2 text-left group-hover:text-primary transition-colors">
                      {project.title || project.prompt.slice(0, 50)}
                    </h3>
                    <p className="text-gray-400 text-sm line-clamp-1 text-left">
                      {project.prompt.slice(0, 60)}...
                    </p>
                  </div>
                </div>

                {/* Shine effect on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </div>
              </motion.button>
            ))}
          </div>

          {/* Empty state */}
          {recentProjects.length === 0 && searchQuery && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <p className="text-gray-400">No projects found matching "{searchQuery}"</p>
            </motion.div>
          )}

          {/* Show all projects link if there are more */}
          {filteredProjects.length > 6 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center pt-4"
            >
              <button
                onClick={() => router.push('/projects')}
                className="text-primary hover:text-primary/80 font-medium text-sm transition-colors"
              >
                View all {filteredProjects.length} projects →
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* New Project Dialog */}
      <NewProjectDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
};

export default HomePage;
