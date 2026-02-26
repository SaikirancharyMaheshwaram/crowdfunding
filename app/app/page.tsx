import Link from "next/link";
import { ArrowRight, CircleDollarSign, ShieldCheck, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f6f2eb] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-black/10 bg-white p-8 shadow-[0_30px_90px_-55px_rgba(0,0,0,.5)]">
          <Badge className="bg-black text-white hover:bg-black">Solana Crowdfunding Protocol</Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 lg:text-6xl">
            Raise with escrow.
            <br />
            Settle with rules.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-600">
            Crowdfi is an all-or-nothing crowdfunding product on Solana. Campaign PDA stores state, Vault PDA holds
            funds, and Donation PDA tracks contributor balances for safe refunds.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="bg-black text-white hover:bg-slate-800" asChild>
              <Link href="/live-funds">
                Open Live Funds
                <ArrowRight />
              </Link>
            </Button>
            <Button variant="outline" className="bg-white" asChild>
              <Link href="/my-donations">View My Donations</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-black/10 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <ShieldCheck className="size-4" />
                Deterministic Security
              </CardTitle>
              <CardDescription>PDA-derived accounts and strict state checks on every instruction.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Withdraw only after success, refund only after failure, and no double-claim paths.
            </CardContent>
          </Card>

          <Card className="border-black/10 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <CircleDollarSign className="size-4" />
                Live Funds Console
              </CardTitle>
              <CardDescription>Create campaigns, monitor progress, and execute protocol actions.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">Multi-wallet support (Phantom, Solflare) and cluster switching.</CardContent>
          </Card>

          <Card className="border-black/10 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Wallet className="size-4" />
                Personal Donation View
              </CardTitle>
              <CardDescription>Track your contributions and see available refund opportunities.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Wallet-linked table of Donation PDAs, campaign status, and claim actions.
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
