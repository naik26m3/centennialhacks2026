import assert from "node:assert/strict";
import test from "node:test";

import type { AnalyzeDocumentCommandOutput } from "@aws-sdk/client-textract";

import {
  extractCanonicalBill,
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
