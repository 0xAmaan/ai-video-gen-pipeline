import "server-only";
import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";

/**
 * Create a Convex HTTP client authenticated as the current Clerk user.
 */
export async function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured.");
  }

  const { userId, getToken } = await auth();
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const token = await getToken({
    template: process.env.CLERK_JWT_TEMPLATE_NAME ?? "convex",
  });

  if (!token) {
    throw new Error("Unable to obtain Clerk token for Convex.");
  }

  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  return client;
}
