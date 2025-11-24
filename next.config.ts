import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["convex"],
  experimental: {
    // Allow multiple dev servers by skipping the default dist lock.
    lockDistDir: false,
    // Permit importing code from external/OpenCut without Next.js refusing to bundle it.
    externalDir: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@/components/editor/editor-header": path.resolve(
        __dirname,
        "external/OpenCut/apps/web/src/components/editor/editor-header.tsx",
      ),
      "@/components/editor/media-panel": path.resolve(
        __dirname,
        "external/OpenCut/apps/web/src/components/editor/media-panel",
      ),
      "@/components/editor/properties-panel": path.resolve(
        __dirname,
        "external/OpenCut/apps/web/src/components/editor/properties-panel",
      ),
      "@/components/editor/timeline": path.resolve(
        __dirname,
        "external/OpenCut/apps/web/src/components/editor/timeline",
      ),
      "@/components/editor/preview-panel": path.resolve(
        __dirname,
        "external/OpenCut/apps/web/src/components/editor/preview-panel.tsx",
      ),
      "@/components/editor/onboarding": path.resolve(
        __dirname,
        "external/OpenCut/apps/web/src/components/editor/onboarding.tsx",
      ),
      "@/components/providers/editor-provider": path.resolve(
        __dirname,
        "external/OpenCut/apps/web/src/components/providers/editor-provider",
      ),
      "@/components/ui/resizable": path.resolve(
        __dirname,
        "external/OpenCut/apps/web/src/components/ui/resizable.tsx",
      ),
      "@/stores/panel-store": path.resolve(
        __dirname,
        "external/OpenCut/apps/web/src/stores/panel-store.ts",
      ),
      "@/stores/project-store": path.resolve(
        __dirname,
        "external/OpenCut/apps/web/src/stores/project-store.ts",
      ),
      "@/hooks/use-playback-controls": path.resolve(
        __dirname,
        "external/OpenCut/apps/web/src/hooks/use-playback-controls.ts",
      ),
    };
    return config;
  },
  turbopack: {
    // Ensure Turbopack roots the build in this workspace (avoids parent lockfiles).
    root: __dirname,
    resolveAlias: {
      "@/components/editor/editor-header":
        "./external/OpenCut/apps/web/src/components/editor/editor-header.tsx",
      "@/components/editor/media-panel":
        "./external/OpenCut/apps/web/src/components/editor/media-panel",
      "@/components/editor/properties-panel":
        "./external/OpenCut/apps/web/src/components/editor/properties-panel",
      "@/components/editor/timeline":
        "./external/OpenCut/apps/web/src/components/editor/timeline",
      "@/components/editor/preview-panel":
        "./external/OpenCut/apps/web/src/components/editor/preview-panel.tsx",
      "@/components/editor/onboarding":
        "./external/OpenCut/apps/web/src/components/editor/onboarding.tsx",
      "@/components/providers/editor-provider":
        "./external/OpenCut/apps/web/src/components/providers/editor-provider",
      "@/components/ui/resizable":
        "./external/OpenCut/apps/web/src/components/ui/resizable.tsx",
      "@/stores/panel-store":
        "./external/OpenCut/apps/web/src/stores/panel-store.ts",
      "@/stores/project-store":
        "./external/OpenCut/apps/web/src/stores/project-store.ts",
      "@/hooks/use-playback-controls":
        "./external/OpenCut/apps/web/src/hooks/use-playback-controls.ts",
    },
  },
  // Enable SharedArrayBuffer/WebCodecs by opting into COOP/COEP on all routes.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            // Use credentialless so third-party media (e.g., Replicate/R2) can load without CORP.
            value: "credentialless",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
