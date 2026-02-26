import type { Metadata } from "next";
import Link from "next/link";

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
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-10">
            <Link href="/" className="text-sm font-semibold tracking-tight text-slate-900">
              CROWDFI
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-700">
              <Link className="hover:text-slate-900" href="/">Landing</Link>
              <Link className="hover:text-slate-900" href="/live-funds">Live Funds</Link>
              <Link className="hover:text-slate-900" href="/my-donations">My Donations</Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
