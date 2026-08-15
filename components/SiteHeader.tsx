"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf } from "lucide-react";
import { SoundToggle } from "@/components/SoundToggle";

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header
      className={
        isHome
          ? "pointer-events-none fixed inset-x-0 top-0 z-30 px-4 sm:px-6"
          : "sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur"
      }
    >
      <div
        className={`pointer-events-auto mx-auto flex items-center justify-between px-4 sm:px-6 ${
          isHome
            ? "mt-4 h-16 max-w-5xl rounded-full border border-white/70 bg-white/58 text-brand shadow-[0_18px_50px_rgba(28,55,39,0.12)] backdrop-blur-2xl sm:mt-6"
            : "h-14 max-w-6xl"
        }`}
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white shadow-[0_5px_14px_rgba(31,92,63,0.22)]">
            <Leaf size={15} aria-hidden="true" />
          </span>
          Greenlight
        </Link>
        <div className="flex items-center gap-2 sm:gap-5">
          <nav className={`hidden items-center gap-7 text-sm sm:flex ${isHome ? "text-brand/80" : "text-ink-soft"}`}>
            <Link href="/opportunities" className="transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
              Opportunities
            </Link>
            <Link href="/plan" className="transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
              Plan
            </Link>
          </nav>
          <SoundToggle />
        </div>
      </div>
    </header>
  );
}
