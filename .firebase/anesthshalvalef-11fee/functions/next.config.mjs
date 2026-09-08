// next.config.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
function resolveAppVersion() {
  const pkg = JSON.parse(
    readFileSync(path.join(__dirname, "package.json"), "utf8")
  );
  let sha = "";
  try {
    sha = execSync("git rev-parse --short HEAD", {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "ignore"]
    }).toString().trim();
  } catch {
  }
  const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return [`v${pkg.version}`, sha, date].filter(Boolean).join(" \xB7 ");
}
var nextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: resolveAppVersion() },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  // Node-only libraries used inside server actions for parsing uploaded files.
  // Keep them external so they are not bundled (they use dynamic require / Node built-ins).
  serverExternalPackages: ["mammoth", "pdf-parse"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" }
    ]
  },
  turbopack: { root: __dirname }
};
var next_config_default = nextConfig;
export {
  next_config_default as default
};
