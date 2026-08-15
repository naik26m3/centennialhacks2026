import { ExternalLink } from "lucide-react";

export function SourceBadge({ url, label, verifiedAt }: { url: string; label: string; verifiedAt: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft hover:text-ink border border-line rounded-md px-2 py-1"
    >
      <ExternalLink size={12} aria-hidden="true" />
      {label} · verified {verifiedAt}
    </a>
  );
}
