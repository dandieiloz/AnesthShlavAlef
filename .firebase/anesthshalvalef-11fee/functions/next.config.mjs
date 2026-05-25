// next.config.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
var nextConfig = {
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  images: { remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }] },
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) }
};
var next_config_default = nextConfig;
export {
  next_config_default as default
};
