// Serves the exported web build on the LAN so a phone browser can open it —
// no Expo Go, no SDK version matching, no app install.
//
//   npx expo export --platform web
//   node serve-dist.mjs
//
// Then open the printed http://<lan-ip>:8080 URL on your phone (same Wi-Fi).

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const PORT = Number(process.env.PORT) || 8080;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

async function resolveFile(pathname) {
  const candidates = [
    path.join(ROOT, pathname),
    path.join(ROOT, `${pathname}.html`),
    path.join(ROOT, pathname, "index.html"),
  ];
  for (const candidate of candidates) {
    // Keep the served tree inside dist/ even if the request contains ../
    if (!candidate.startsWith(ROOT)) continue;
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  const file = (await resolveFile(pathname === "/" ? "/index.html" : pathname)) ?? path.join(ROOT, "index.html");

  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
}).listen(PORT, "0.0.0.0", () => {
  console.log(`\nGreenlight web build serving on port ${PORT}\n`);
  console.log(`  This machine:  http://localhost:${PORT}`);
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        console.log(`  Phone (${name}):  http://${addr.address}:${PORT}`);
      }
    }
  }
  console.log("\nPhone must be on the same Wi-Fi. Ctrl+C to stop.\n");
});
