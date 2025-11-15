"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

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

  // Show login page for unauthenticated users
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <main className="w-full max-w-md p-8">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold">Welcome</h1>
          <p className="text-muted-foreground">
            Sign in to start creating videos
          </p>
          <div className="flex flex-col gap-3 pt-4">
            <SignInButton mode="modal">
              <button className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium cursor-pointer">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="w-full px-6 py-3 border border-border rounded-lg hover:bg-accent font-medium cursor-pointer">
                Sign Up
              </button>
            </SignUpButton>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
