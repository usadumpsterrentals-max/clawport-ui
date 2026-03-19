import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Collect all local network IPs so the dev server accepts cross-origin
 *  requests from LAN, Tailscale, or any non-localhost address. */
function getLocalIPs() {
  const ips = [];
  const interfaces = networkInterfaces();
  for (const addrs of Object.values(interfaces)) {
    for (const addr of addrs) {
      if (!addr.internal) ips.push(addr.address);
    }
  }
  return ips;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins: ["local-origin.dev", "*.local-origin.dev", ...getLocalIPs()],
  async rewrites() {
    const gateway = "http://127.0.0.1:18789";
    return [
      // Proxy /canvas → OpenClaw Canvas UI
      {
        source: "/canvas",
        destination: `${gateway}/__openclaw__/canvas/`,
      },
      {
        source: "/canvas/:path*",
        destination: `${gateway}/__openclaw__/canvas/:path*`,
      },
      // Proxy all __openclaw__ paths (API, WebSocket, assets)
      {
        source: "/__openclaw__/:path*",
        destination: `${gateway}/__openclaw__/:path*`,
      },
    ];
  },
};

export default nextConfig;
