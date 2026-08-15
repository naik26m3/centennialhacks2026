import Link from "next/link";
import { Leaf } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-canvas/95 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-medium text-[15px]">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-white">
            <Leaf size={14} aria-hidden="true" />
          </span>
          Greenlight
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-ink-soft">
          <Link href="/opportunities" className="hover:text-ink">Opportunities</Link>
          <Link href="/plan" className="hover:text-ink">Negotiator</Link>
        </nav>
      </div>
    </header>
  );
}
