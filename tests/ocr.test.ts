import assert from "node:assert/strict";
import test from "node:test";

import type { AnalyzeDocumentCommandOutput } from "@aws-sdk/client-textract";

import {
  analyzeBillDocument,
  extractCanonicalBill,
  extractCanonicalBillFromOpenRouter,
  getOcrProvider,
  maskAccountNumber,
  parseOcrDocumentInput,
} from "../lib/ocr";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function query(alias: string, text: string, confidence = 96) {
  return [
    {
      BlockType: "QUERY" as const,
      Id: `query-${alias}`,
      Query: { Alias: alias, Text: alias },
      Relationships: [{ Type: "ANSWER" as const, Ids: [`answer-${alias}`] }],
    },
    {
      BlockType: "QUERY_RESULT" as const,
      Id: `answer-${alias}`,
      Text: text,
      Confidence: confidence,
      Page: 2,
      Geometry: { BoundingBox: { Left: 0.1, Top: 0.2, Width: 0.3, Height: 0.04 } },
    },
  ];
}

test("validates OCR type, size, and magic bytes", () => {
  assert.equal(parseOcrDocumentInput({ bytes: jpeg, contentType: "image/jpeg" }).bytes.length, 4);
  assert.throws(() => parseOcrDocumentInput({ bytes: jpeg, contentType: "image/png" }), /match contentType/);
  assert.throws(() => parseOcrDocumentInput({ bytes: new Uint8Array(), contentType: "image/jpeg" }), /between/);
  assert.throws(() => parseOcrDocumentInput({ bytes: jpeg, contentType: "text/plain" }), /contentType/);
});

test("normalizes Textract query results and masks account evidence", () => {
  const response = {
    Blocks: [
      ...query("provider", "Toronto Hydro", 98),
      ...query("billing_period", "2026-04-13 - 2026-05-12"),
      ...query("total", "$123.45"),
      ...query("usage", "456.7 kWh"),
      ...query("account_number", "1234-5678-9012", 91),
    ],
  } as AnalyzeDocumentCommandOutput;

  const bill = extractCanonicalBill(response);
  assert.deepEqual(bill.provider.value, "Toronto Hydro");
  assert.deepEqual(bill.billingPeriod.value, { start: "2026-04-13", end: "2026-05-12" });
  assert.equal(bill.total.value, 123.45);
  assert.deepEqual(bill.usage.value, { value: 456.7, unit: "kWh" });
  assert.equal(bill.accountNumber.value, "••••••••9012");
  assert.equal(bill.accountNumber.evidence[0]?.text, "••••••••9012");
  assert.equal(bill.accountNumber.evidence[0]?.page, 2);
  assert.equal(bill.accountNumber.evidence[0]?.boundingBox?.left, 0.1);
  assert.equal(maskAccountNumber("1234-5678-9012"), "••••••••9012");
  assert.equal(JSON.stringify(bill).includes("1234-5678-9012"), false);
});

test("uses an explicit OpenRouter provider and keeps model evidence review-required", async () => {
  const previous = {
    provider: process.env.OCR_PROVIDER,
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_CHAT_MODEL,
  };
  process.env.OCR_PROVIDER = "openrouter";
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_CHAT_MODEL = "google/gemini-3.6-flash";
  const extraction = {
    provider: { value: "Toronto Hydro", confidence: 99, page: 2 },
    billing_period: { value: { start: "2026-04-13", end: "2026-05-12" }, confidence: 88, page: 2 },
    total: { value: "$123.45", confidence: 95, page: 2 },
    usage: { value: { value: "456.7", unit: "kWh" }, confidence: 35, page: 2 },
    account_number: { value: "1234-5678-9012", confidence: 91, page: 2 },
  };
  const calls: unknown[] = [];
  const generateObjectFn = (async (options: unknown) => {
    calls.push(options);
    return { object: extraction };
  }) as never;

  try {
    assert.equal(getOcrProvider(), "openrouter");
    const bill = await analyzeBillDocument({ bytes: jpeg, contentType: "image/jpeg" }, { generateObjectFn });
    assert.equal(bill.total.value, 123.45);
    assert.equal(bill.total.confidence, 75);
    assert.equal(bill.usage.confidence, 35);
    assert.equal(bill.accountNumber.value, "••••••••9012");
    assert.equal(JSON.stringify(bill).includes("1234-5678-9012"), false);
    const message = (calls[0] as { messages: Array<{ content: Array<{ type: string; data?: Uint8Array }> }> }).messages[0];
    assert.equal(message.content[1]?.type, "file");
    assert.deepEqual(message.content[1]?.data, jpeg);
  } finally {
    if (previous.provider === undefined) delete process.env.OCR_PROVIDER; else process.env.OCR_PROVIDER = previous.provider;
    if (previous.apiKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = previous.apiKey;
    if (previous.model === undefined) delete process.env.OPENROUTER_CHAT_MODEL; else process.env.OPENROUTER_CHAT_MODEL = previous.model;
  }
});

test("normalizes standalone OpenRouter output without Textract geometry", () => {
  const bill = extractCanonicalBillFromOpenRouter({
    provider: { value: "Hydro One", confidence: 100, page: null },
    billing_period: { value: { start: "April 1, 2026", end: "April 30, 2026" }, confidence: 80, page: null },
    total: { value: 44.5, confidence: null, page: null },
    usage: { value: { value: 20, unit: "m3" }, confidence: 80, page: null },
    account_number: { value: null, confidence: null, page: null },
  });
  assert.deepEqual(bill.billingPeriod.value, { start: "2026-04-01", end: "2026-04-30" });
  assert.deepEqual(bill.usage.value, { value: 20, unit: "m³" });
  assert.equal(bill.provider.evidence[0]?.source, "openrouter");
  assert.equal(bill.provider.evidence[0]?.boundingBox, undefined);
  assert.equal(bill.total.confidence, null);
});
