import type { Metadata } from "next";
import "./globals.css";
import { GreenlightProvider } from "@/lib/context/greenlight-context";
import { SiteHeader } from "@/components/SiteHeader";
import { AudioBootstrap } from "@/components/AudioBootstrap";

export const metadata: Metadata = {
  title: "Greenlight — make the greener move the obvious move",
  description:
    "Your personal sustainability negotiator. Upload a utility bill, Greenlight finds the incentives you qualify for and prepares the paperwork to claim them.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        <GreenlightProvider>
          <AudioBootstrap />
          <SiteHeader />
          <main className="flex-1 flex flex-col">{children}</main>
        </GreenlightProvider>
      </body>
    </html>
  );
}
