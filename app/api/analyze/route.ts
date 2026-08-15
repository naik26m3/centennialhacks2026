import { NextRequest, NextResponse } from "next/server";

import { buildHouseholdProfileFromBills, matchOpportunitiesLive } from "@/lib/adapters/live-provider";
import {
  analyzeBillDocument,
  OcrValidationError,
  type CanonicalBillOcr,
} from "@/lib/ocr";
import type { UtilityBillExtraction } from "@/lib/types";

export function toUtilityBillExtraction(bill: CanonicalBillOcr): UtilityBillExtraction {
  const provider = bill.provider.value;
  const usage = bill.usage.value;
  const unit = usage?.unit?.toLowerCase().replace(/\s+/g, "") ?? "";
  const isElectricity = unit === "kwh";
  const isNaturalGas = (unit === "m3" || unit === "m³") && /\b(?:enbridge|gas)\b/i.test(provider ?? "");
  const confidences = [
    bill.provider.confidence,
    bill.billingPeriod.confidence,
    bill.total.confidence,
    bill.usage.confidence,
  ].filter((value): value is number => value !== null);
  const missingCriticalFields = [
    !provider && "provider",
    !bill.billingPeriod.value && "billingPeriod",
    bill.total.value === null && "totalAmount",
    !usage && "usage",
    "serviceAddress",
  ].filter((field): field is string => Boolean(field));

  return {
    provider,
    accountType: "unknown",
    serviceAddress: { city: null, provinceState: null, postalCode: null, country: null },
    billingPeriod: {
      start: bill.billingPeriod.value?.start ?? null,
      end: bill.billingPeriod.value?.end ?? null,
    },
    electricity: isElectricity ? { usageKwh: usage!.value, cost: bill.total.value } : null,
    naturalGas: isNaturalGas ? { usageM3: usage!.value, cost: bill.total.value } : null,
    totalAmount: bill.total.value,
    currency: "CAD",
    primaryHeatingHint: "unknown",
    detectedHeatingClues: [],
    confidence: confidences.length
      ? Math.min(1, Math.max(0, confidences.reduce((sum, value) => sum + value, 0) / confidences.length / 100))
      : 0,
    missingCriticalFields,
  };
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart file upload." }, { status: 400 });
  }

  const files = formData.getAll("files").filter((value): value is File => value instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  try {
    const bills = await Promise.all(
      files.map(async (file) =>
        toUtilityBillExtraction(
          await analyzeBillDocument({
            bytes: new Uint8Array(await file.arrayBuffer()),
            contentType: file.type,
          }),
        ),
      ),
    );
    const household = buildHouseholdProfileFromBills(bills);
    const opportunities = await matchOpportunitiesLive(bills, household);
    return NextResponse.json({ mode: "live" as const, bills, household, opportunities });
  } catch (error) {
    if (error instanceof OcrValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("OpenRouter bill analysis failed:", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ error: "Bill analysis is temporarily unavailable." }, { status: 502 });
  }
}
