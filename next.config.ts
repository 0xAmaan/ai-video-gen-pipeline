import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["convex"],
  turbopack: {
    // Ensure Turbopack roots the build in this workspace (avoids parent lockfiles).
    root: __dirname,
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
            value: "credentialless",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
