import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  // tesseract.js locates its worker script on disk relative to its own
  // package at runtime; bundling it rewrites those paths and breaks that
  // lookup, so it needs to be loaded via native require() instead.
  serverExternalPackages: ["tesseract.js", "pdf-parse"],
};

export default nextConfig;
