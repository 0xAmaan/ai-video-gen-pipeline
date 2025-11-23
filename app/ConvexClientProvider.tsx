"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import { ReactNode, useMemo } from "react";

export const ConvexClientProvider = ({ children }: { children: ReactNode }) => {
  // Skip Convex/Clerk bridge on routes that don't need backend auth (e.g., Remotion MVP)
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/remotion-editor")) {
    return <>{children}</>;
  }

  const convex = useMemo(() => {
    const convexUrl =
      process.env.NEXT_PUBLIC_CONVEX_URL ??
      (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3210" : undefined);

    if (!convexUrl) {
      throw new Error(
        "Missing NEXT_PUBLIC_CONVEX_URL. Start `bunx convex dev` or set the env var to your Convex deployment URL.",
      );
    }

    return new ConvexReactClient(convexUrl);
  }, []);

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
};
