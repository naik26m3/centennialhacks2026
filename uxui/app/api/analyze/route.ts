import { NextRequest, NextResponse } from "next/server";
import { analyzeBillsBatchWithGemini, hasLiveGeminiKey } from "@/lib/ai/gemini";
import { buildHouseholdProfileFromBills, matchOpportunitiesLive } from "@/lib/adapters/live-provider";
import { analyzeBillDemo, buildHouseholdProfile, matchOpportunities } from "@/lib/adapters/demo-provider";

function demoResult(fallbackReason?: string) {
  const bills = [analyzeBillDemo()];
  const household = buildHouseholdProfile();
  return {
    mode: "demo" as const,
    fallbackReason,
    bills,
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
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  try {
    const fileParts = await Promise.all(
      files.map(async (file) => ({
        mimeType: file.type || "application/octet-stream",
        data: Buffer.from(await file.arrayBuffer()).toString("base64"),
      }))
    );
    const bills = await analyzeBillsBatchWithGemini(fileParts);
    const household = buildHouseholdProfileFromBills(bills);
    const opportunities = await matchOpportunitiesLive(bills, household);
    return NextResponse.json({ mode: "live" as const, bills, household, opportunities });
  } catch (err) {
    console.error("Live Gemini bill analysis failed, falling back to the demo fixtures:", err);
    return NextResponse.json(demoResult("Live analysis couldn't read those files, so we're showing the sample household instead."));
  }
}
