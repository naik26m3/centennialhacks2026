"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGreenlight } from "@/lib/context/greenlight-context";
import { parseGoalPrompt, buildNegotiatedPlan } from "@/lib/calculations/constraint-solver";
import { NegotiatedPlanView } from "@/components/NegotiatedPlanView";

const CHIPS = ["Save me money", "Find every rebate", "Lowest upfront cost", "Reduce energy use"];

export default function PlanPage() {
  const router = useRouter();
  const { household, opportunities, goal, setGoal, hydrated } = useGreenlight();
  const [input, setInput] = useState(goal?.rawPrompt ?? "");

  useEffect(() => {
    if (hydrated && !household) router.replace("/");
  }, [hydrated, household, router]);

  if (!household) return null;

  const submit = (raw: string) => {
    setInput(raw);
    setGoal(parseGoalPrompt(raw));
  };

  const plan = buildNegotiatedPlan(opportunities, goal);

  return (
    <div className="flex-1 px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-medium mb-1">Give us the constraint</h1>
        <p className="text-[14px] text-ink-soft mb-6">
          Tell Greenlight what to optimize for and it will negotiate the best realistic combination of the programs it found.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => submit(chip)}
              className="text-[13px] rounded-full border border-line px-3 py-1.5 hover:border-line-strong hover:bg-card"
            >
              {chip}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="flex gap-2 mb-8"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Save me $1,000 this year without spending more than $500 upfront."
            className="flex-1 rounded-lg border border-line px-3 py-2.5 text-[14px] bg-card focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
          <button type="submit" className="rounded-lg bg-ink text-white text-[14px] font-medium px-4 py-2.5 hover:bg-ink/90">
            Negotiate
          </button>
        </form>

        {goal && (
          <div>
            <p className="text-[13px] font-medium mb-3">Your negotiated plan</p>
            <NegotiatedPlanView plan={plan} />
          </div>
        )}
      </div>
    </div>
  );
}
