import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  // Node-only libraries used inside server actions for parsing uploaded files.
  // Keep them external so they are not bundled (they use dynamic require / Node built-ins).
  serverExternalPackages: ["mammoth", "pdf-parse"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
};
export default nextConfig;
