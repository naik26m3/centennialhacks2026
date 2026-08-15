"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useGreenlight } from "@/lib/context/greenlight-context";
import { AgentTimeline } from "@/components/AgentTimeline";
import { AdministratorChain } from "@/components/AdministratorChain";
import { ApplicationPacket } from "@/components/ApplicationPacket";
import { DemoModeBadge } from "@/components/DemoModeBadge";

export default function AgentCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const router = useRouter();
  const { household, opportunities, cases, hydrated, isLive, getOrCreateCase, answerTenure } = useGreenlight();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (hydrated && !household) router.replace("/");
  }, [hydrated, household, router]);

  const opportunity = opportunities.find((o) => o.id === caseId);
  const agentCase = opportunity ? cases[`case-${opportunity.id}`] ?? null : null;

  useEffect(() => {
    if (opportunity && !agentCase) getOrCreateCase(opportunity.id);
  }, [opportunity, agentCase, getOrCreateCase]);

  if (!household || !opportunity || !agentCase) return null;

  const needsHuman = agentCase.status === "awaiting_human";

  return (
    <div className="flex-1 px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[13px] text-ink-muted">Preparing your next step</p>
          <DemoModeBadge live={isLive} />
        </div>
        <h1 className="text-2xl font-medium mb-6">Let Greenlight handle the paperwork</h1>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="order-2 lg:order-1">
            <AgentTimeline events={agentCase.events} />
          </div>

          <div className="order-1 lg:order-2 flex flex-col gap-4">
            {needsHuman && (
              <div className="rounded-lg border border-warning bg-warning-soft p-4">
                <p className="text-[13px] font-medium mb-3">Do you own or rent this property?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => answerTenure("owner")}
                    className="flex-1 rounded-lg bg-ink text-white text-[13px] font-medium py-2 hover:bg-ink/90"
                  >
                    Own
                  </button>
                  <button
                    onClick={() => answerTenure("renter")}
                    className="flex-1 rounded-lg border border-line-strong text-[13px] font-medium py-2 hover:bg-card"
                  >
                    Rent
                  </button>
                </div>
              </div>
            )}

            {!needsHuman && (
              <>
                <AdministratorChain route={agentCase.actionRoute!} />
                <ApplicationPacket fields={agentCase.applicationFields} />

                {agentCase.draftMessage ? (
                  <div className="rounded-lg border border-line bg-card p-4">
                    <p className="text-[13px] font-medium mb-2">Ready to contact the program administrator</p>
                    <pre className="whitespace-pre-wrap text-[12.5px] text-ink-soft bg-canvas rounded-md p-3 border border-line max-h-56 overflow-y-auto font-sans">
                      {agentCase.draftMessage}
                    </pre>
                    <p className="text-[11px] text-ink-muted mt-2">
                      We draft it, you review and send it — Greenlight never submits anything on your behalf without approval.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(agentCase.draftMessage ?? "");
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }}
                        className="flex-1 rounded-lg border border-line-strong text-[13px] font-medium py-2 hover:bg-canvas"
                      >
                        {copied ? "Copied" : "Copy"}
                      </button>
                      <button className="flex-1 rounded-lg bg-ink text-white text-[13px] font-medium py-2 hover:bg-ink/90">
                        Approve
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-line bg-card p-4">
                    <p className="text-[13px] font-medium mb-1">Best next step</p>
                    <p className="text-[13px] text-ink-soft mb-3">
                      This program doesn&apos;t require an email. Applications are submitted through the official program portal.
                    </p>
                    <a
                      href={agentCase.actionRoute?.applicationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center rounded-lg bg-ink text-white text-[13px] font-medium py-2 hover:bg-ink/90"
                    >
                      Continue application
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
