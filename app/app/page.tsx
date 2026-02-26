import Link from "next/link";
import { ArrowRight, CircleDollarSign, Lock, ShieldCheck, Sparkles, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f6f2eb] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="relative overflow-hidden rounded-3xl border border-black/10 bg-white p-8 shadow-[0_30px_90px_-55px_rgba(0,0,0,.5)]">
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-amber-200/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-slate-200/50 blur-3xl" />

          <Badge className="bg-black text-white hover:bg-black">Crowdfi Protocol</Badge>
          <h1 className="relative mt-4 text-4xl font-semibold tracking-tight text-slate-900 lg:text-6xl">
            All-or-Nothing Funding.
            <br />
            Fully On-Chain.
          </h1>
          <p className="relative mt-4 max-w-3xl text-base text-slate-600">
            Crowdfi is a Solana crowdfunding product with deterministic PDA escrow architecture.
            Campaign state, vault treasury, and per-donor balances are isolated for reliable settlement.
          </p>

          <div className="relative mt-6 flex flex-wrap gap-3">
            <Button className="bg-black text-white hover:bg-slate-800" asChild>
              <Link href="/live-funds">
                Open Live Funds
                <ArrowRight />
              </Link>
            </Button>
            <Button variant="outline" className="bg-white" asChild>
              <Link href="/create-campaign">Create Campaign</Link>
            </Button>
            <Button variant="outline" className="bg-white" asChild>
              <Link href="/my-donations">My Donations</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-black/10 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900"><ShieldCheck className="size-4" />Deterministic Security</CardTitle>
              <CardDescription>PDA-derived state and treasury accounts with strict on-chain guards.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">No dynamic resizing, explicit overflow checks, and secure invoke_signed flows.</CardContent>
          </Card>

          <Card className="border-black/10 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900"><CircleDollarSign className="size-4" />Escrow Treasury</CardTitle>
              <CardDescription>Funds are separated from metadata via Vault PDA.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">Withdraw only if successful, refund only if failed. State machine is derived, not stored.</CardContent>
          </Card>

          <Card className="border-black/10 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900"><Wallet className="size-4" />Donor Accountability</CardTitle>
              <CardDescription>Per-donor Donation PDA tracks exact refundable amount.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">Clear auditability of donations and no double-refund path.</CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card className="border-black/10 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900"><Lock className="size-4" />Instruction Flow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p>1. Create Campaign: Campaign PDA + Vault PDA initialized.</p>
              <p>2. Donate: donor sends SOL to vault and donation ledger updates.</p>
              <p>3. Withdraw: owner-only after success.</p>
              <p>4. Refund: donor-only after failed deadline.</p>
            </CardContent>
          </Card>

          <Card className="border-black/10 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900"><Sparkles className="size-4" />Product Pages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p><strong>Live Funds:</strong> campaign board with card-native actions and tx confirmations.</p>
              <p><strong>Create Campaign:</strong> dedicated publishing workflow with validation.</p>
              <p><strong>My Donations:</strong> wallet-specific donation ledger and campaign status context.</p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
