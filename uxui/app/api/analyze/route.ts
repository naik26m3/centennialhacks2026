import { NextRequest, NextResponse } from "next/server";
import { analyzeBillWithGemini, hasLiveGeminiKey } from "@/lib/ai/gemini";
import { buildHouseholdProfileFromBill, matchOpportunitiesLive } from "@/lib/adapters/live-provider";
import { analyzeBillDemo, buildHouseholdProfile, matchOpportunities } from "@/lib/adapters/demo-provider";

function demoResult(fallbackReason?: string) {
  const bill = analyzeBillDemo();
  const household = buildHouseholdProfile();
  return {
    mode: "demo" as const,
    fallbackReason,
    bill,
    household,
    opportunities: matchOpportunities(household),
  };
}

// Never let a flaky live call take down the demo — any failure here falls
// back to the fixture-backed demo path (README "Going live with real Gemini", step 4).
export async function POST(request: NextRequest) {
  if (!hasLiveGeminiKey()) {
    return NextResponse.json(demoResult());
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");
    const bill = await analyzeBillWithGemini(base64, file.type || "application/octet-stream");
    const household = buildHouseholdProfileFromBill(bill);
    const opportunities = await matchOpportunitiesLive(bill, household);
    return NextResponse.json({ mode: "live" as const, bill, household, opportunities });
  } catch (err) {
    console.error("Live Gemini bill analysis failed, falling back to the demo fixtures:", err);
    return NextResponse.json(demoResult("Live analysis couldn't read that file, so we're showing the sample household instead."));
  }
}
