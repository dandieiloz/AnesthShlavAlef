import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Build a version string that changes on every deployment.
 * Combines the package.json version with the git short SHA (when available)
 * and the build date. Regenerated each time `next build` runs.
 */
function resolveAppVersion() {
  const pkg = JSON.parse(
    readFileSync(path.join(__dirname, "package.json"), "utf8"),
  );
  let sha = "";
  try {
    sha = execSync("git rev-parse --short HEAD", {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    // git not available in the build environment; fall back to date only.
  }
  const date = new Date().toISOString().slice(0, 10);
  return [`v${pkg.version}`, sha, date].filter(Boolean).join(" · ");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: resolveAppVersion() },
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
  turbopack: { root: __dirname },
};
export default nextConfig;
