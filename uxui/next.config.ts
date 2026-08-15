import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // This is an intentionally isolated Next.js app inside a larger repository
  // that has its own lockfile and backend proxy. Pinning the Turbopack root
  // prevents Next from walking upward and bundling root-only server modules.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
