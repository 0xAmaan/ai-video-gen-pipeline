"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import { ReactNode } from "react";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  (process.env.NODE_ENV === "development" ? "http://127.0.0.1:3210" : undefined);

if (!convexUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_CONVEX_URL. Start `bunx convex dev` or set the env var to your Convex deployment URL.",
  );
}

const convex = new ConvexReactClient(convexUrl);

export const ConvexClientProvider = ({ children }: { children: ReactNode }) => {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
};
