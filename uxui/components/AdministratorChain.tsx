import { ActionRoute } from "@/lib/types";

export function AdministratorChain({ route }: { route: ActionRoute }) {
  const steps = [
    { label: "Funding authority", value: "Government of Ontario" },
    { label: "Program owner", value: "Home Renovation Savings program" },
    { label: "Administrator", value: route.administeringOrganization },
    { label: "Application method", value: route.preferredSubmissionMethod ?? route.routeType.replace("_", " ") },
    { label: "Verified destination", value: route.verified ? "Confirmed" : "Not verified", verified: route.verified },
  ];

  return (
    <div className="rounded-lg border border-line bg-card p-4">
      <ul className="flex flex-col">
        {steps.map((s, i) => (
          <li key={s.label} className="relative pl-6 pb-4 last:pb-0">
            {i < steps.length - 1 && (
              <span className="absolute left-[7px] top-4 bottom-0 w-px bg-line" aria-hidden="true" />
            )}
            <span
              className={`absolute left-0 top-1 h-3.5 w-3.5 rounded-full border-2 ${
                "verified" in s && s.verified ? "bg-success border-success" : "bg-card border-line-strong"
              }`}
              aria-hidden="true"
            />
            <p className="text-[11px] text-ink-muted uppercase tracking-wide">{s.label}</p>
            <p className="text-[14px] font-medium">{s.value}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
