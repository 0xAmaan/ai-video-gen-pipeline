"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Video, Wand2, Zap, ArrowRight } from "lucide-react";

const Home = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if auth is loaded and user is signed in
    if (isLoaded && isSignedIn) {
      router.push("/new");
    }
  }, [isLoaded, isSignedIn, router]);

  // Show nothing while checking auth or while redirecting
  if (!isLoaded || isSignedIn) {
    return null;
  }

  const features = [
    {
      icon: Sparkles,
      title: "AI-Powered Generation",
      description: "Transform your ideas into stunning videos with cutting-edge AI technology",
    },
    {
      icon: Video,
      title: "Scene Planning",
      description: "Break down your story into scenes and shots with intelligent planning tools",
    },
    {
      icon: Wand2,
      title: "Instant Iteration",
      description: "Refine and perfect every shot with real-time AI-powered variations",
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Go from concept to completed video in minutes, not hours",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--bg-base)] via-[var(--bg-surface-dark)] to-[var(--bg-base)]">
      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated background gradient */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -inset-[10px] opacity-50">
            <motion.div
              className="absolute top-1/4 -left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
              animate={{
                x: [0, 100, 0],
                y: [0, 50, 0],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute bottom-1/4 -right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
              animate={{
                x: [0, -100, 0],
                y: [0, -50, 0],
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 25,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </div>
        </div>

        {/* Content */}
        <main className="relative z-10 w-full max-w-6xl mx-auto px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Hero Text */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20"
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    AI Video Generation Platform
                  </span>
                </motion.div>

                <h1 className="text-5xl lg:text-6xl font-bold tracking-tight text-white">
                  Turn Ideas Into
                  <span className="block bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Stunning Videos
                  </span>
                </h1>

                <p className="text-xl text-gray-400 leading-relaxed">
                  Create professional videos with AI-powered scene planning, shot iteration, and instant generation. No editing experience required.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <SignInButton mode="modal">
                  <button
                    onClick={() => {}}
                    className="group px-8 py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/20 cursor-pointer flex items-center justify-center gap-2"
                  >
                    Get Started
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button
                    onClick={() => {}}
                    className="px-8 py-4 border-2 border-gray-700 text-white rounded-xl font-semibold text-lg hover:bg-gray-800/50 transition-all duration-300 cursor-pointer"
                  >
                    Sign Up Free
                  </button>
                </SignUpButton>
              </div>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex gap-8 pt-4"
              >
                <div>
                  <div className="text-3xl font-bold text-white">10x</div>
                  <div className="text-sm text-gray-500">Faster Creation</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-white">AI</div>
                  <div className="text-sm text-gray-500">Powered</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-white">∞</div>
                  <div className="text-sm text-gray-500">Possibilities</div>
                </div>
              </motion.div>
            </motion.div>

            {/* Right: Features Grid */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="grid grid-cols-2 gap-4"
            >
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="group p-6 rounded-2xl bg-gradient-to-br from-gray-800/40 to-gray-900/40 border border-gray-700/50 hover:border-primary/50 transition-all duration-300 hover:scale-105 backdrop-blur-sm"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Home;
