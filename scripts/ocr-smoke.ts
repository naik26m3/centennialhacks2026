import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { analyzeBillDocument } from "../lib/ocr";

/** Opt-in live check; only the checked-in JPEG fixtures are accepted. */
export async function main(path = process.argv[2]) {
  if (!path) throw new Error("Usage: npx tsx scripts/ocr-smoke.ts tests/file/<fixture>.jpeg");
  const root = process.cwd();
  const file = resolve(root, path);
  const fixtureRoot = resolve(root, "tests/file");
  const relativePath = relative(fixtureRoot, file);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath) || !/^.+\.jpeg$/i.test(relativePath)) {
    throw new Error("Only a tests/file/*.jpeg fixture may be used for the OCR smoke check.");
  }

  const bytes = new Uint8Array(await readFile(file));
  const bill = await analyzeBillDocument({ bytes, contentType: "image/jpeg" });
  console.log(JSON.stringify({
    ok: true,
    provider: process.env.OCR_PROVIDER ?? "textract",
    fields: Object.fromEntries(Object.entries(bill).map(([name, field]) => [name, {
      present: field.value !== null,
      confidence: field.confidence,
      evidenceCount: field.evidence.length,
    }])),
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const statusCode = error && typeof error === "object" && "statusCode" in error
      && typeof error.statusCode === "number" ? error.statusCode : undefined;
    console.error(JSON.stringify({
      ok: false,
      errorName,
      ...(statusCode === undefined ? {} : { statusCode }),
      blocker: process.env.OCR_PROVIDER === "openrouter"
        ? "OpenRouter API call failed (check OPENROUTER_API_KEY, OPENROUTER_CHAT_MODEL, or network); document output suppressed."
        : "AWS credentials, Textract permissions, region, or network may be unavailable; document output suppressed.",
    }));
    process.exitCode = 1;
  });
}
