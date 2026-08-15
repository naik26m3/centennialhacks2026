"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useGreenlight } from "@/lib/context/greenlight-context";
import { AgentTimeline } from "@/components/AgentTimeline";
import { AdministratorChain } from "@/components/AdministratorChain";
import { ApplicationPacket } from "@/components/ApplicationPacket";
import { DemoResolution } from "@/components/DemoResolution";
import { DemoModeBadge } from "@/components/DemoModeBadge";
import { EligibilityDelta } from "@/components/EligibilityDelta";
import { CinematicReveal } from "@/components/motion/CinematicReveal";
import { TactileButton } from "@/components/motion/TactileButton";
import { useGreenlightAudio } from "@/hooks/useGreenlightAudio";
import { motionTokens } from "@/lib/motion/tokens";

export default function AgentCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  const router = useRouter();
  const { household, opportunities, cases, lastTenureDelta, presentationMode, hydrated, isLive, getOrCreateCase, answerTenure } = useGreenlight();
  const { play } = useGreenlightAudio();
  const shouldReduceMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [questionVisible, setQuestionVisible] = useState(false);
  const [approved, setApproved] = useState(false);
  const playedAttention = useRef(false);
  const playedComplete = useRef(false);

  useEffect(() => {
    if (hydrated && !household) router.replace("/");
  }, [hydrated, household, router]);

  const opportunity = opportunities.find((o) => o.id === caseId);
  const agentCase = opportunity ? cases[`case-${opportunity.id}`] ?? null : null;

  useEffect(() => {
    if (opportunity && !agentCase) getOrCreateCase(opportunity.id);
  }, [opportunity, agentCase, getOrCreateCase]);

  const needsHuman = agentCase?.status === "awaiting_human";

  useEffect(() => {
    if (!needsHuman) return;
    const timer = window.setTimeout(() => setQuestionVisible(true), shouldReduceMotion ? 80 : 960);
    return () => window.clearTimeout(timer);
  }, [needsHuman, shouldReduceMotion]);

  useEffect(() => {
    if (!needsHuman || playedAttention.current) return;
    playedAttention.current = true;
    play("attention");
  }, [needsHuman, play]);

  useEffect(() => {
    if (!approved || playedComplete.current) return;
    playedComplete.current = true;
    play("complete");
  }, [approved, play]);

  if (!household || !opportunity || !agentCase) return null;

  return (
    <div className="flex-1 px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[13px] text-ink-muted">Turning eligibility into action</p>
          <DemoModeBadge live={isLive} />
        </div>
        <h1 className="text-2xl font-medium mb-6">Greenlight is handling it.</h1>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="order-2 lg:order-1">
            <motion.div
              animate={{ opacity: needsHuman && questionVisible ? 0.48 : 1 }}
              transition={{ duration: shouldReduceMotion ? 0 : motionTokens.duration.slow, ease: motionTokens.easeOut }}
            >
              <AgentTimeline events={agentCase.events} />
            </motion.div>
          </div>

          <div className="order-1 lg:order-2 flex flex-col gap-4">
            {needsHuman && questionVisible && (
              <CinematicReveal>
                <div className="rounded-lg border border-warning bg-warning-soft p-4 shadow-[0_14px_34px_rgba(156,107,11,0.10)]">
                  <p className="text-[13px] font-medium mb-3">Do you own or rent this property?</p>
                  <div className="flex gap-2">
                    <TactileButton
                      onClick={() => answerTenure("owner")}
                      className="flex-1 rounded-lg bg-ink text-white text-[13px] font-medium py-2 hover:bg-ink/90"
                    >
                      Own
                    </TactileButton>
                    <TactileButton
                      onClick={() => answerTenure("renter")}
                      className="flex-1 rounded-lg border border-line-strong text-[13px] font-medium py-2 hover:bg-card"
                    >
                      Rent
                    </TactileButton>
                  </div>
                </div>
              </CinematicReveal>
            )}

            {!needsHuman && (
              <>
                {lastTenureDelta && <EligibilityDelta delta={lastTenureDelta} />}
                <AdministratorChain route={agentCase.actionRoute!} />
                <ApplicationPacket fields={agentCase.applicationFields} />

                {agentCase.draftMessage ? (
                  <CinematicReveal delay={shouldReduceMotion ? 0 : 0.62}>
                    <div className="rounded-lg border border-line bg-card p-4">
                      <p className="text-[13px] font-medium mb-2">Ready to contact the program administrator</p>
                      <pre className="whitespace-pre-wrap text-[12.5px] text-ink-soft bg-canvas rounded-md p-3 border border-line max-h-56 overflow-y-auto font-sans">
                        {agentCase.draftMessage}
                      </pre>
                      <p className="text-[11px] text-ink-muted mt-2">
                        We draft it. You review and send it. Greenlight never submits anything without your approval.
                      </p>
                      <div className="flex gap-2 mt-3">
                        <TactileButton
                          onClick={() => {
                            navigator.clipboard.writeText(agentCase.draftMessage ?? "");
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                          }}
                          className="flex-1 rounded-lg border border-line-strong text-[13px] font-medium py-2 hover:bg-canvas"
                        >
                          {copied ? "Copied" : "Copy"}
                        </TactileButton>
                        <TactileButton onClick={() => setApproved(true)} className="flex-1 rounded-lg bg-ink text-white text-[13px] font-medium py-2 hover:bg-ink/90">
                          Approve
                        </TactileButton>
                      </div>
                    </div>
                  </CinematicReveal>
                ) : (
                  <CinematicReveal delay={shouldReduceMotion ? 0 : 0.62}>
                    <div className="rounded-lg border border-line bg-card p-4">
                      <p className="text-[13px] font-medium mb-1">Best next step</p>
                      <p className="text-[13px] text-ink-soft mb-3">
                        This program doesn&apos;t require an email. Applications are submitted through the official program portal.
                      </p>
                      <div className="flex flex-col gap-2">
                        <TactileButton onClick={() => setApproved(true)} className="w-full rounded-lg bg-ink py-2 text-[13px] font-medium text-white hover:bg-ink/90">
                          Review prepared application
                        </TactileButton>
                        <a href={agentCase.actionRoute?.applicationUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => { if (presentationMode) { event.preventDefault(); setApproved(true); } }} className="block rounded-lg border border-line-strong py-2 text-center text-[12px] font-medium hover:bg-canvas">
                          Open official portal
                        </a>
                      </div>
                    </div>
                  </CinematicReveal>
                )}
                {approved && <DemoResolution opportunity={opportunity} agentCase={agentCase} />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
