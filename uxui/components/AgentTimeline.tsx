import { CheckCircle2, CircleDashed, HelpCircle, XCircle } from "lucide-react";
import { AgentEvent } from "@/lib/types";

const icons = {
  complete: <CheckCircle2 size={16} className="text-success" aria-hidden="true" />,
  in_progress: <CircleDashed size={16} className="text-ink-muted animate-spin" aria-hidden="true" />,
  needs_human: <HelpCircle size={16} className="text-warning" aria-hidden="true" />,
  blocked: <XCircle size={16} className="text-danger" aria-hidden="true" />,
};

export function AgentTimeline({ events }: { events: AgentEvent[] }) {
  const groups = Array.from(new Set(events.map((e) => e.group)));
  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group}>
          <p className="text-[12px] font-medium text-ink-muted uppercase tracking-wide mb-2">{group}</p>
          <ul className="flex flex-col gap-2">
            {events.filter((e) => e.group === group).map((e) => (
              <li key={e.id} className="flex items-center gap-2.5 text-[14px]">
                {icons[e.status]}
                <span className={e.status === "blocked" ? "text-ink-muted" : "text-ink"}>{e.title}</span>
                {e.detail && <span className="text-[12px] text-warning">{e.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
