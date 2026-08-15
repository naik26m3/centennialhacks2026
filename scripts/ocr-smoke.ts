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
  console.log(JSON.stringify({ ok: true, bill }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error(JSON.stringify({
      ok: false,
      errorName,
      blocker: "AWS credentials, Textract permissions, region, or network may be unavailable; inspect AWS configuration without logging document contents.",
    }));
    process.exitCode = 1;
  });
}
