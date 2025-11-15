import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define which routes require authentication
const isProtectedRoute = createRouteMatcher([
  "/new(.*)",
  "/:projectId/prompt(.*)",
  "/:projectId/storyboard(.*)",
  "/:projectId/video(.*)",
  "/:projectId/editor(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect authenticated routes
  if (isProtectedRoute(req)) {
    const { userId } = await auth();

    if (!userId) {
      // Redirect to home page for unauthenticated users
      const homeUrl = new URL("/", req.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
