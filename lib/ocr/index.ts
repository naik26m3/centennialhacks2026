import {
  AnalyzeDocumentCommand,
  TextractClient,
  type AnalyzeDocumentCommandOutput,
  type Block,
} from "@aws-sdk/client-textract";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { generateObject, jsonSchema } from "ai";

import { getOpenRouter, getOpenRouterChatModel } from "@/lib/ai/openrouter";
import { usesVercelOidc } from "@/lib/uploads";

export const OCR_CONTENT_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
export type OcrContentType = (typeof OCR_CONTENT_TYPES)[number];

export const OCR_MAX_BYTES = 10 * 1024 * 1024;

export type OcrBoundingBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type OcrEvidence = {
  page: number;
  text: string;
  confidence: number;
  source?: OcrProvider;
  boundingBox?: OcrBoundingBox;
};

export type OcrField<T> = {
  value: T | null;
  confidence: number | null;
  evidence: OcrEvidence[];
};

export type BillingPeriod = {
  start: string;
  end: string;
};

export type Usage = {
  value: number;
  unit: string | null;
};

/** The only shape that leaves the OCR boundary. Account values are always masked. */
export type CanonicalBillOcr = {
  provider: OcrField<string>;
  billingPeriod: OcrField<BillingPeriod>;
  total: OcrField<number>;
  usage: OcrField<Usage>;
  accountNumber: OcrField<string>;
};

export type OcrDocumentInput = {
  bytes: Uint8Array;
  contentType: OcrContentType;
};

export type OcrProvider = "openrouter" | "textract";

export class OcrValidationError extends Error {
  override name = "OcrValidationError";
}

const QUERIES = [
  { Text: "What is the utility provider or supplier name?", Alias: "provider" },
  { Text: "What is the billing period or service period?", Alias: "billing_period" },
  { Text: "What is the total amount due?", Alias: "total" },
  { Text: "What is the total energy or water usage and its unit?", Alias: "usage" },
  { Text: "What is the account number?", Alias: "account_number" },
] as const;

type OpenRouterBillField<T> = {
  value: T | null;
  confidence: number | null;
  page: number | null;
};

type OpenRouterBillExtraction = {
  provider: OpenRouterBillField<string>;
  billing_period: OpenRouterBillField<{ start: string | null; end: string | null }>;
  total: OpenRouterBillField<number | string>;
  usage: OpenRouterBillField<{ value: number | string; unit: string | null }>;
  account_number: OpenRouterBillField<string>;
};

const OPENROUTER_SCHEMA = jsonSchema<OpenRouterBillExtraction>({
  type: "object",
  additionalProperties: false,
  required: ["provider", "billing_period", "total", "usage", "account_number"],
  properties: {
    provider: { type: "object", additionalProperties: false, required: ["value", "confidence", "page"], properties: {
      value: { type: ["string", "null"], description: "Exact printed utility issuer/provider name from the logo, masthead, contact details, website, or repeated brand text." }, confidence: { type: ["number", "null"] }, page: { type: ["integer", "null"] },
    } },
    billing_period: { type: "object", additionalProperties: false, required: ["value", "confidence", "page"], properties: {
      value: { type: ["object", "null"], additionalProperties: false, required: ["start", "end"], properties: {
        start: { type: ["string", "null"] }, end: { type: ["string", "null"] },
      } }, confidence: { type: ["number", "null"] }, page: { type: ["integer", "null"] },
    } },
    total: { type: "object", additionalProperties: false, required: ["value", "confidence", "page"], properties: {
      value: { type: ["number", "string", "null"] }, confidence: { type: ["number", "null"] }, page: { type: ["integer", "null"] },
    } },
    usage: { type: "object", additionalProperties: false, required: ["value", "confidence", "page"], properties: {
      value: { type: ["object", "null"], description: "Current billing-period consumption, not a meter reading, daily average, or historical chart value.", additionalProperties: false, required: ["value", "unit"], properties: {
        value: { type: ["number", "string"], description: "Numeric current-period amount; gas bills may label this 'You used'." }, unit: { type: ["string", "null"], description: "Unit such as kWh or m³." },
      } }, confidence: { type: ["number", "null"] }, page: { type: ["integer", "null"] },
    } },
    account_number: { type: "object", additionalProperties: false, required: ["value", "confidence", "page"], properties: {
      value: { type: ["string", "null"] }, confidence: { type: ["number", "null"] }, page: { type: ["integer", "null"] },
    } },
  },
});

export function getOcrProvider(): OcrProvider {
  const provider = (process.env.OCR_PROVIDER?.trim().toLowerCase() || "textract") as OcrProvider;
  if (provider !== "openrouter" && provider !== "textract") {
    throw new OcrValidationError("OCR_PROVIDER must be openrouter or textract.");
  }
  return provider;
}

const MONTHS: Record<string, string> = {
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
  apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07",
  aug: "08", august: "08", sep: "09", sept: "09", september: "09", oct: "10",
  october: "10", nov: "11", november: "11", dec: "12", december: "12",
};

type Candidate = {
  value: string;
  block: Block;
};

function isContentType(value: unknown): value is OcrContentType {
  return typeof value === "string" && (OCR_CONTENT_TYPES as readonly string[]).includes(value);
}

function hasPrefix(bytes: Uint8Array, prefix: number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value);
}

function hasExpectedMagic(bytes: Uint8Array, contentType: OcrContentType): boolean {
  if (contentType === "image/jpeg") return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
  if (contentType === "image/png") return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
}

export function parseOcrDocumentInput(input: unknown): OcrDocumentInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new OcrValidationError("OCR input must be an object.");
  }
  const body = input as Record<string, unknown>;
  const bytes = body.bytes;
  const contentType = body.contentType;
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > OCR_MAX_BYTES) {
    throw new OcrValidationError(`Document bytes must be between 1 and ${OCR_MAX_BYTES} bytes.`);
  }
  if (!isContentType(contentType)) {
    throw new OcrValidationError("contentType must be image/jpeg, image/png, or application/pdf.");
  }
  if (!hasExpectedMagic(bytes, contentType)) {
    throw new OcrValidationError("Document bytes do not match contentType.");
  }
  return { bytes: new Uint8Array(bytes), contentType };
}

function emptyField<T>(): OcrField<T> {
  return { value: null, confidence: null, evidence: [] };
}

function confidence(block: Block): number {
  return typeof block.Confidence === "number" && Number.isFinite(block.Confidence)
    ? Math.max(0, Math.min(100, block.Confidence))
    : 0;
}

function evidence(block: Block, text = block.Text ?? ""): OcrEvidence {
  const box = block.Geometry?.BoundingBox;
  return {
    page: typeof block.Page === "number" && block.Page > 0 ? block.Page : 1,
    text: text.trim(),
    confidence: confidence(block),
    source: "textract",
    ...(box && [box.Left, box.Top, box.Width, box.Height].every((value) => typeof value === "number")
      ? { boundingBox: { left: box.Left!, top: box.Top!, width: box.Width!, height: box.Height! } }
      : {}),
  };
}

function blocksForQueries(blocks: Block[]): Map<string, Candidate> {
  const byId = new Map(blocks.flatMap((block) => block.Id ? [[block.Id, block] as const] : []));
  const values = new Map<string, Candidate>();
  for (const query of blocks.filter((block) => block.BlockType === "QUERY" && block.Query?.Alias)) {
    const relationship = query.Relationships?.find((item) => item.Type === "ANSWER");
    const result = relationship?.Ids?.map((id) => byId.get(id)).find((block) => block?.BlockType === "QUERY_RESULT");
    if (result?.Text && query.Query?.Alias) values.set(query.Query.Alias, { value: result.Text.trim(), block: result });
  }
  return values;
}

function lineCandidate(blocks: Block[], pattern: RegExp): Candidate | undefined {
  for (const block of blocks) {
    if (block.BlockType !== "LINE" || !block.Text) continue;
    const match = block.Text.match(pattern);
    if (match?.[1]?.trim()) return { value: match[1].trim(), block };
  }
  return undefined;
}

function candidateFor(values: Map<string, Candidate>, blocks: Block[], alias: string, pattern: RegExp): Candidate | undefined {
  return values.get(alias) ?? lineCandidate(blocks, pattern);
}

function parseDate(value: string): string | undefined {
  const normalized = value.replace(/[,]/g, " ").replace(/\s+/g, " ").trim();
  let match = normalized.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = normalized.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  match = normalized.match(/\b([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})\b/);
  if (!match) match = normalized.match(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/);
  if (!match) return undefined;
  const month = MONTHS[match[1].toLowerCase()] ?? MONTHS[match[2].toLowerCase()];
  const day = /^\d+$/.test(match[1]) ? match[1] : match[2];
  if (!month || !day || Number(day) < 1 || Number(day) > 31) return undefined;
  return `${match[3]}-${month}-${day.padStart(2, "0")}`;
}

function parsePeriod(value: string): BillingPeriod | undefined {
  const matches = value.match(/\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,)?\s+\d{4}|\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4})\b/gi) ?? [];
  const parsed = matches.map(parseDate).filter(Boolean) as string[];
  return parsed.length >= 2 ? { start: parsed[0], end: parsed[1] } : undefined;
}

function parseMoney(value: string): number | undefined {
  const match = value.replace(/,/g, "").match(/(?:CAD\s*)?\$?\s*\(?([0-9]+(?:\.[0-9]{1,2})?)\)?/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : undefined;
}

function parseUsage(value: string): Usage | undefined {
  const normalized = value.replace(/,/g, "").replace(/\bcubic\s+met(?:er|re)s?\b|m\^3/gi, "m3");
  const match = normalized.match(/\b([0-9]+(?:\.[0-9]+)?)\s*(kWh|m3|m³|GJ|L)(?![A-Za-z0-9])/i);
  if (!match) return undefined;
  const unit = match[2].toLowerCase();
  return { value: Number(match[1]), unit: unit === "m3" || unit === "m³" ? "m³" : unit === "kwh" ? "kWh" : unit.toUpperCase() };
}

export function maskAccountNumber(value: string): string {
  const compact = value.replace(/[^A-Za-z0-9]/g, "");
  if (!compact) return "••••";
  return `${"•".repeat(Math.max(4, compact.length - 4))}${compact.slice(-4)}`;
}

function maskedField(candidate: Candidate | undefined): OcrField<string> {
  if (!candidate) return emptyField();
  return {
    value: maskAccountNumber(candidate.value),
    confidence: confidence(candidate.block),
    evidence: [evidence(candidate.block, maskAccountNumber(candidate.value))],
  };
}

function textField<T>(candidate: Candidate | undefined, value: T | undefined): OcrField<T> {
  if (!candidate || value === undefined) return emptyField();
  return { value, confidence: confidence(candidate.block), evidence: [evidence(candidate.block)] };
}

/** Deterministic normalization of already-returned Textract blocks. No AWS calls or logging. */
export function extractCanonicalBill(response: AnalyzeDocumentCommandOutput): CanonicalBillOcr {
  const blocks = response.Blocks ?? [];
  const values = blocksForQueries(blocks);
  const provider = candidateFor(values, blocks, "provider", /^\s*(?:utility\s+)?(?:provider|supplier)\s*[:#-]\s*(.+)$/i);
  const period = candidateFor(values, blocks, "billing_period", /^\s*(?:billing|service)\s+period\s*[:#-]\s*(.+)$/i);
  const total = candidateFor(values, blocks, "total", /^\s*(?:total(?:\s+amount)?\s+due|amount\s+due)\s*[:#-]\s*(.+)$/i);
  const usage = candidateFor(values, blocks, "usage", /^\s*(?:total\s+)?(?:usage|consumption)\s*[:#-]\s*(.+)$/i);
  const account = candidateFor(values, blocks, "account_number", /^\s*(?:account|customer)\s*(?:number|no\.?|#)\s*[:#-]?\s*(.+)$/i);

  return {
    provider: textField(provider, provider?.value),
    billingPeriod: textField(period, period && parsePeriod(period.value)),
    total: textField(total, total && parseMoney(total.value)),
    usage: textField(usage, usage && parseUsage(usage.value)),
    accountNumber: maskedField(account),
  };
}

function modelConfidence(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  // OpenRouter has no Textract geometry/evidence. Keep every model result below
  // the normal auto-accept threshold so it remains review-required.
  return Math.max(0, Math.min(75, value));
}

function modelEvidence<T>(value: T, field: OpenRouterBillField<unknown>): OcrEvidence[] {
  const confidence = modelConfidence(field.confidence) ?? 0;
  return [{
    page: typeof field.page === "number" && Number.isInteger(field.page) && field.page > 0 ? field.page : 1,
    text: String(value).trim(),
    confidence,
    source: "openrouter",
  }];
}

function modelField<T>(field: OpenRouterBillField<unknown>, value: T | undefined): OcrField<T> {
  if (value === undefined || value === null || (typeof value === "string" && !value.trim())) return emptyField();
  return { value, confidence: modelConfidence(field.confidence), evidence: modelEvidence(value, field) };
}

/** Normalize structured OpenRouter output without exposing account values or inventing geometry. */
export function extractCanonicalBillFromOpenRouter(result: OpenRouterBillExtraction): CanonicalBillOcr {
  const period = result.billing_period?.value;
  const start = typeof period?.start === "string" ? parseDate(period.start) : undefined;
  const end = typeof period?.end === "string" ? parseDate(period.end) : undefined;
  const normalizedPeriod = start && end ? { start, end } : undefined;

  const totalValue = result.total?.value;
  const total = totalValue === null || totalValue === undefined ? undefined : parseMoney(String(totalValue));

  const usageValue = result.usage?.value;
  const usageText = usageValue?.value === null || usageValue?.value === undefined
    ? undefined
    : `${usageValue.value}${usageValue.unit ? ` ${usageValue.unit}` : ""}`;
  const usage = usageText ? parseUsage(usageText) : undefined;

  const provider = typeof result.provider?.value === "string" ? result.provider.value.trim() : undefined;
  const account = typeof result.account_number?.value === "string" ? result.account_number.value : undefined;

  return {
    provider: modelField(result.provider, provider),
    billingPeriod: modelField(result.billing_period, normalizedPeriod),
    total: modelField(result.total, total),
    usage: modelField(result.usage, usage),
    accountNumber: account ? {
      value: maskAccountNumber(account),
      confidence: modelConfidence(result.account_number.confidence),
      evidence: modelEvidence(maskAccountNumber(account), result.account_number),
    } : emptyField(),
  };
}

function createTextractClient(): TextractClient {
  const region = process.env.AWS_REGION?.trim() || "ca-central-1";
  const roleArn = process.env.AWS_ROLE_ARN?.trim();
  return new TextractClient({
    region,
    ...(usesVercelOidc(undefined, roleArn) && roleArn
      ? { credentials: awsCredentialsProvider({ roleArn, clientConfig: { region } }) }
      : {}),
  });
}

export async function analyzeBillDocument(
  input: unknown,
  options: { client?: TextractClient; generateObjectFn?: typeof generateObject } = {},
): Promise<CanonicalBillOcr> {
  const document = parseOcrDocumentInput(input);
  if (getOcrProvider() === "openrouter") {
    const generate = options.generateObjectFn ?? generateObject;
    const { object } = await generate({
      model: getOpenRouter()(getOpenRouterChatModel()),
      schema: OPENROUTER_SCHEMA,
      schemaName: "canonical_utility_bill",
      schemaDescription: "Canonical utility bill fields. Use null when a field is not legible or absent.",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Read this utility bill and return only fields supported by the schema. Do not guess; use null when a field is absent or illegible. Identify the exact printed provider or issuer from the logo, masthead, contact details, website, or repeated brand text, not from a generic service category. For usage, extract the current billing-period total, not meter readings, daily averages, or historical charts. On natural-gas bills it is often labeled 'You used' under 'How much gas did I use?' and reported in m³ or m3; on electricity or water bills use the labeled current-period kWh or m³ consumption. Include the source page when clear; otherwise use null. Account numbers are sensitive and will be masked after extraction." },
          { type: "file", mediaType: document.contentType, data: document.bytes },
        ],
      }],
    });
    return extractCanonicalBillFromOpenRouter(object);
  }
  const client = options.client ?? createTextractClient();
  const response = await client.send(new AnalyzeDocumentCommand({
    Document: { Bytes: document.bytes },
    FeatureTypes: ["FORMS", "QUERIES"],
    QueriesConfig: { Queries: [...QUERIES] },
  }));
  return extractCanonicalBill(response);
}
