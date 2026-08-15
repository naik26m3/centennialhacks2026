// Local development harness for the OCR slice — NOT part of the Next.js app,
// not deployed, not imported by any app code.
//
// It exists because `app/api/**` belongs to the backend/reasoning agent
// (docs/OWNERSHIP.md) and pages belong to the frontend teammate, so the OCR
// slice needs its own way to be exercised against real bills without editing
// anyone else's paths. When a route handler for uploads exists, this can go.
//
// Run from the app root:  npx --yes tsx lib/ocr/dev/harness.ts

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extractBill, MAX_FILE_BYTES } from "../extract-bill";
import { hasLiveGeminiKey, getModel } from "../gemini";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, "../../..");

// Node 20.12+ built-in .env loader — no dotenv dependency needed.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(APP_ROOT, file));
  } catch {
    // Absent is fine — the pipeline falls back to demo mode on its own.
  }
}

const PORT = Number(process.env.OCR_DEV_PORT) || 4000;
// base64 inflates bytes by ~4/3; leave room for the JSON envelope too.
const MAX_BODY_BYTES = Math.ceil(MAX_FILE_BYTES * 1.4);

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    total += (chunk as Buffer).length;
    if (total > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(await readFile(path.join(HERE, "index.html"), "utf8"));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    const live = hasLiveGeminiKey();
    json(res, 200, {
      mode: live ? "live" : "demo",
      model: live ? getModel() : null,
      strategy: live ? "gemini_direct" : "demo_fixture",
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/ocr") {
    try {
      const body = JSON.parse(await readBody(req)) as {
        fileName?: string;
        mimeType?: string;
        dataBase64?: string;
      };

      if (!body.dataBase64 || !body.mimeType) {
        json(res, 400, { ok: false, code: "empty_file", error: "Send { fileName, mimeType, dataBase64 }." });
        return;
      }

      const result = await extractBill({
        data: Buffer.from(body.dataBase64, "base64"),
        mimeType: body.mimeType,
        fileName: body.fileName,
      });
      json(res, result.ok ? 200 : 422, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[ocr-dev] request failed:", message);
      json(res, 500, { ok: false, code: "model_error", error: message });
    }
    return;
  }

  json(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, () => {
  const mode = hasLiveGeminiKey() ? `live (${getModel()})` : "demo (no GEMINI_API_KEY)";
  console.log(`OCR dev harness -> http://localhost:${PORT}  [${mode}]`);
});
