"use client";

import { usePathname } from "next/navigation";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { LayoutWrapper } from "./LayoutWrapper";

/**
 * Route-aware provider wrapper.
 * Skips Clerk/Convex/LayoutWrapper on public routes like /remotion-editor.
 */
export const RootProviders = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname() || "/";
  const isPublic = pathname.startsWith("/remotion-editor");

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider>
      <ConvexClientProvider>
        <LayoutWrapper>{children}</LayoutWrapper>
      </ConvexClientProvider>
    </ClerkProvider>
  );
};
