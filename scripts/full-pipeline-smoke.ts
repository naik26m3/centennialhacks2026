import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";


const DEFAULT_API_BASE = "https://centennialhacks2026.vercel.app";
const DEFAULT_FIXTURE = "tests/file/toronto-hydro_electricity_2026-04-13_2026-05-12.jpeg";

type Json = Record<string, unknown>;

function record(value: unknown, label: string): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} was not an object.`);
  return value as Json;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${label} was missing.`);
  return value;
}

async function api(
  apiBase: string,
  path: string,
  init: RequestInit,
  expected: readonly number[],
): Promise<{ status: number; body: Json }> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    // Authentication was removed for the hackathon build (see lib/auth).
    headers: { ...init.headers },
  });
  const body = record(await response.json(), `${init.method ?? "GET"} ${path} response`);
  if (!expected.includes(response.status)) {
    const error = body.error && typeof body.error === "object" && !Array.isArray(body.error)
      ? body.error as Json
      : {};
    const code = typeof error.code === "string" ? error.code : "unknown_error";
    throw new Error(`${init.method ?? "GET"} ${path} failed (${response.status}, ${code}).`);
  }
  return { status: response.status, body };
}

function data(body: Json, label: string): Json {
  return record(body.data, `${label} data`);
}

/** Opt-in live check; it accepts only local JPEG fixtures and never prints extracted values. */
export async function main(fixtureArg = process.argv[2] ?? DEFAULT_FIXTURE) {
  const root = process.cwd();
  const fixture = resolve(root, fixtureArg);
  const fixtureRoot = resolve(root, "tests/file");
  const fixtureRelative = relative(fixtureRoot, fixture);
  if (!fixtureRelative || fixtureRelative.startsWith("..") || isAbsolute(fixtureRelative) || !/^.+\.jpeg$/i.test(fixtureRelative)) {
    throw new Error("Only a tests/file/*.jpeg fixture may be used for the full pipeline smoke check.");
  }

  const apiBase = (process.env.API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, "");
  const bytes = await readFile(fixture);
  const checksum = createHash("sha256").update(bytes).digest("base64");

  const nonce = randomUUID();

  const caseKey = `pipeline-case-${nonce}`;
  const created = await api(apiBase, "/api/cases", {
    method: "POST",
    headers: { "idempotency-key": caseKey },
  }, [200, 201]);
  const caseId = string(data(created.body, "case").caseId, "caseId");

  const uploadKey = `pipeline-upload-${nonce}`;
  const reserved = await api(apiBase, "/api/uploads", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": uploadKey },
    body: JSON.stringify({
      caseId,
      filename: basename(fixture),
      contentType: "image/jpeg",
      size: bytes.byteLength,
      sha256: checksum,
      idempotencyKey: uploadKey,
    }),
  }, [200]);
  const reservation = data(reserved.body, "upload reservation");
  const documentId = string(reservation.documentId, "documentId");
  const upload = record(reservation.upload, "upload");
  const uploadHeaders = record(upload.headers, "upload headers");
  const put = await fetch(string(upload.url, "upload URL"), {
    method: "PUT",
    headers: Object.fromEntries(Object.entries(uploadHeaders).map(([key, value]) => [key, string(value, key)])),
    body: bytes,
  });
  if (!put.ok) throw new Error(`Private S3 upload failed (${put.status}).`);

  const completed = await api(apiBase, `/api/uploads/${documentId}/complete`, { method: "POST" }, [200]);
  const completedStatus = string(data(completed.body, "upload completion").status, "upload completion status");
  const analyzed = await api(apiBase, `/api/documents/${documentId}/analyze`, { method: "POST" }, [200]);
  const analyzedData = data(analyzed.body, "analysis");
  const analyzedStatus = string(analyzedData.status, "analysis status");
  const fields = Array.isArray(analyzedData.fields) ? analyzedData.fields.map((field) => record(field, "field")) : [];
  if (fields.length === 0) throw new Error("OCR returned no reviewable fields.");

  for (const field of fields) {
    await api(apiBase, `/api/documents/${documentId}/fields`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fieldId: string(field.id, "field id"), action: "confirm" }),
    }, [200]);
  }

  const evaluated = await api(apiBase, `/api/cases/${caseId}/evaluate`, { method: "POST" }, [200]);
  const evaluation = data(evaluated.body, "evaluation");
  const resultResponse = await api(apiBase, `/api/cases/${caseId}/result`, { method: "GET" }, [200]);
  const result = data(resultResponse.body, "result");
  const opportunities = Array.isArray(result.opportunities)
    ? result.opportunities.map((opportunity) => record(opportunity, "opportunity"))
    : [];
  if (opportunities.length === 0) throw new Error("Evaluation produced no opportunities.");

  const eligible = opportunities.find((opportunity) => opportunity.eligibility === "eligible");
  let actionOutcome = "manual_review_blocked";
  if (eligible) {
    const opportunityId = string(eligible.evaluationId, "eligible evaluation id");
    const prepared = await api(apiBase, `/api/opportunities/${opportunityId}/prepare`, {
      method: "POST",
      headers: { "idempotency-key": `pipeline-prepare-${nonce}` },
    }, [200, 201]);
    const actionId = string(data(prepared.body, "prepared action").id, "actionId");
    await api(apiBase, `/api/actions/${actionId}/approve`, {
      method: "POST",
      headers: { "idempotency-key": `pipeline-approve-${nonce}` },
    }, [200]);
    actionOutcome = "approved";
  } else {
    const opportunityId = string(opportunities[0]?.evaluationId, "evaluation id");
    const blocked = await api(apiBase, `/api/opportunities/${opportunityId}/prepare`, {
      method: "POST",
      headers: { "idempotency-key": `pipeline-blocked-${nonce}` },
    }, [409]);
    const error = record(blocked.body.error, "blocked action error");
    if (error.code !== "action_not_approvable") throw new Error("Manual-review action was not safely blocked.");
  }

  console.log(JSON.stringify({
    ok: true,
    apiBase,
    caseId,
    documentId,
    uploadStatus: completedStatus,
    analysisStatus: analyzedStatus,
    reviewedFieldCount: fields.length,
    evaluationStatus: evaluation.status,
    opportunityCount: opportunities.length,
    eligibility: opportunities.map((opportunity) => opportunity.eligibility),
    evidenceCounts: opportunities.map((opportunity) => Array.isArray(opportunity.evidence) ? opportunity.evidence.length : 0),
    actionOutcome,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Pipeline smoke failed.",
    }));
    process.exitCode = 1;
  });
}
