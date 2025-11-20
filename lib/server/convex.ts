import "server-only";
import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";

interface ConvexClientOptions {
  requireUser?: boolean;
}

/**
 * Create a Convex HTTP client authenticated as the current Clerk user.
 * Pass { requireUser: false } to create an unauthenticated client, useful for
 * background jobs or server-to-server calls.
 */
export async function getConvexClient(
  options?: ConvexClientOptions,
) {
  const requireUser = options?.requireUser ?? true;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured.");
  }

  const { userId, getToken } = await auth();
  const client = new ConvexHttpClient(convexUrl);
  if (userId) {
    const token = await getToken({
      template: process.env.CLERK_JWT_TEMPLATE_NAME ?? "convex",
    });

    if (!token) {
      throw new Error("Unable to obtain Clerk token for Convex.");
    }

    client.setAuth(token);
  } else if (requireUser) {
    throw new Error("Not authenticated");
  }

  return client;
}
