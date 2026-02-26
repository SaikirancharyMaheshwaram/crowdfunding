import type { Metadata } from "next";
import Link from "next/link";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crowdfi",
  description: "PDA-based escrow crowdfunding on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <header className="sticky top-0 z-50 border-b border-black/10 bg-[#f6f2eb]/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-10">
            <Link href="/" className="rounded-full border border-black/20 bg-white px-3 py-1 text-xs font-semibold tracking-[0.2em] text-slate-900">
              CROWDFI
            </Link>

            <nav className="flex items-center gap-2 rounded-full border border-black/10 bg-white p-1 text-sm">
              <NavLink href="/">Landing</NavLink>
              <NavLink href="/live-funds">Live Funds</NavLink>
              <NavLink href="/create-campaign">Create</NavLink>
              <NavLink href="/my-donations">My Donations</NavLink>
            </nav>
          </div>
        </header>

        {children}
        <Toaster />
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-full px-3 py-1.5 text-slate-700 transition hover:bg-slate-100 hover:text-slate-900">
      {children}
    </Link>
  );
}
