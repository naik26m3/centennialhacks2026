import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { AgentCase, Opportunity } from "@/lib/types";

export function DemoResolution({ opportunity, agentCase }: { opportunity: Opportunity; agentCase: AgentCase }) {
  const prepared = agentCase.applicationFields.filter((field) => !["missing", "declaration"].includes(field.source)).length;
  return (
    <section className="rounded-2xl border border-brand/25 bg-brand p-5 text-white shadow-[0_22px_60px_rgba(31,92,63,0.20)] sm:p-6">
      <CheckCircle2 size={24} className="text-white/85" aria-hidden="true" />
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em]">The money was already there.</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-white/78">Greenlight removed the uncertainty between this household and the correct next action.</p>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-[12px]">
        <div><dt className="text-white/60">Potential incentive</dt><dd className="mt-1 text-xl font-semibold tabular-nums">${opportunity.estimatedIncentive.toLocaleString("en-CA")}</dd></div>
        <div><dt className="text-white/60">Fields prepared</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{prepared} / {agentCase.applicationFields.length}</dd></div>
        <div><dt className="text-white/60">Verified route</dt><dd className="mt-1 font-semibold">{agentCase.actionRoute?.verified ? "Found" : "Not verified"}</dd></div>
        <div><dt className="text-white/60">Human approvals</dt><dd className="mt-1 font-semibold">Still required</dd></div>
      </dl>
      <Link href="/plan" className="mt-5 block rounded-xl bg-white px-4 py-3 text-center text-[13px] font-semibold text-brand hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Try a what-if</Link>
    </section>
  );
}
