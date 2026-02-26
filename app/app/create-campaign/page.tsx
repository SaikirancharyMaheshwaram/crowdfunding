"use client";

import { useState } from "react";
import { ArrowUpRight, Loader2, Wallet } from "lucide-react";
import { PublicKey } from "@solana/web3.js";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import {
  CROWDFI_PROGRAM_ID,
  type ClusterKind,
  type WalletKey,
  connectWallet,
  deriveCampaignPda,
  getConnectedWalletAddress,
  getWalletByKey,
  programUrl,
  saveCampaignId,
  sendCreateCampaignTx,
  txUrl,
} from "@/lib/crowdfi-client";

function toLamports(solInput: string) {
  const num = Number(solInput);
  if (!Number.isFinite(num) || num <= 0) throw new Error("Amount must be greater than 0");
  return BigInt(Math.round(num * 1_000_000_000));
}

function toEndTimeFromHours(hoursInput: string) {
  const hours = Number(hoursInput);
  if (!Number.isFinite(hours) || hours <= 0) throw new Error("Duration must be greater than 0 hours");
  return Math.floor(Date.now() / 1000 + hours * 60 * 60);
}

function parseCampaignId(input: string) {
  const num = Number(input.trim());
  if (!Number.isInteger(num) || num < 0) throw new Error("Campaign ID must be a positive integer");
  return BigInt(num);
}

function shortPk(value: PublicKey | string) {
  const str = typeof value === "string" ? value : value.toBase58();
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

export default function CreateCampaignPage() {
  const [cluster, setCluster] = useState<ClusterKind>("devnet");
  const [walletKey, setWalletKey] = useState<WalletKey>("phantom");
  const [walletPk, setWalletPk] = useState(() => getConnectedWalletAddress("phantom"));

  const [createCampaignId, setCreateCampaignId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createGoalSol, setCreateGoalSol] = useState("");
  const [createDurationHours, setCreateDurationHours] = useState("24");
  const [createNotes, setCreateNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [lastCreated, setLastCreated] = useState<{ id: string; pda: string } | null>(null);

  async function onConnectWallet() {
    try {
      const pk = await connectWallet(walletKey);
      setWalletPk(pk.toBase58());
      toast.success({ title: "Wallet connected", description: shortPk(pk) });
    } catch (err) {
      toast.error({ title: "Wallet connection failed", description: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  async function onCreateCampaign() {
    try {
      const wallet = getWalletByKey(walletKey);
      if (!wallet?.publicKey) throw new Error("Connect wallet first");

      setSubmitting(true);
      const campaignId = createCampaignId.trim() ? parseCampaignId(createCampaignId) : BigInt(Math.floor(Date.now() / 1000));
      const sig = await sendCreateCampaignTx(wallet, cluster, {
        campaignId,
        title: createTitle,
        goalLamports: toLamports(createGoalSol),
        endTimeTs: toEndTimeFromHours(createDurationHours),
      });

      const campaignPda = deriveCampaignPda(wallet.publicKey, campaignId);
      saveCampaignId(cluster, campaignPda, campaignId);
      setLastCreated({ id: campaignId.toString(), pda: campaignPda.toBase58() });
      setStatus(`Created campaign ID ${campaignId.toString()} (${shortPk(campaignPda)}). tx: ${sig}`);
      toast.success({
        title: `Campaign #${campaignId.toString()} created`,
        description: shortPk(sig),
        actionLabel: "View on Orb",
        actionHref: txUrl(sig, cluster),
      });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Create campaign failed");
      toast.error({ title: "Create campaign failed", description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#faf7f2] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_25px_70px_-50px_rgba(0,0,0,.5)] lg:p-8">
          <Badge className="bg-black text-white hover:bg-black">Create Campaign</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 lg:text-5xl">Publish a New Fundraise</h1>
          <p className="mt-3 text-sm text-slate-600 lg:text-base">
            You are creating both the Campaign PDA and Vault PDA in one on-chain transaction.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Cluster</Label>
              <Select value={cluster} onValueChange={(value) => setCluster(value as ClusterKind)}>
                <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="devnet">devnet</SelectItem>
                  <SelectItem value="localnet">localnet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Wallet</Label>
              <Select value={walletKey} onValueChange={(value) => setWalletKey(value as WalletKey)}>
                <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="phantom">Phantom</SelectItem>
                  <SelectItem value="solflare">Solflare</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Wallet Status</Label>
              {walletPk ? (
                <Button variant="outline" className="w-full justify-start bg-white"><Wallet />{shortPk(walletPk)}</Button>
              ) : (
                <Button className="w-full bg-black text-white hover:bg-slate-800" onClick={onConnectWallet}><Wallet />Connect</Button>
              )}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            Program ID: {CROWDFI_PROGRAM_ID.toBase58()}
          </div>

          <Card className="mt-6 border-black/10 bg-white">
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
              <CardDescription>Campaign ID is optional. If empty, it is auto-generated from current timestamp and saved locally.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Campaign ID (Optional)">
                  <Input value={createCampaignId} onChange={(e) => setCreateCampaignId(e.target.value)} placeholder="auto if empty" />
                </Field>
                <Field label="Duration (Hours)">
                  <Input value={createDurationHours} onChange={(e) => setCreateDurationHours(e.target.value)} placeholder="24" />
                </Field>
              </div>

              <Field label="Title">
                <Input maxLength={25} value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Indie Film Release" />
              </Field>

              <Field label="Goal (SOL)">
                <Input value={createGoalSol} onChange={(e) => setCreateGoalSol(e.target.value)} placeholder="15" />
              </Field>

              <Field label="Notes">
                <Textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder="Optional context" />
              </Field>
            </CardContent>
            <CardFooter className="justify-between bg-slate-50">
              <p className="text-xs text-slate-500">{status}</p>
              <Button className="bg-black text-white hover:bg-slate-800" onClick={onCreateCampaign} disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : null}
                Create On-Chain
              </Button>
            </CardFooter>
          </Card>

          {lastCreated ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Campaign created: ID <span className="font-semibold">{lastCreated.id}</span> and PDA <span className="font-semibold">{shortPk(lastCreated.pda)}</span>
            </div>
          ) : null}

          <Button className="mt-4 bg-slate-900 text-white hover:bg-slate-800" asChild>
            <a href={programUrl(cluster)} rel="noreferrer" target="_blank">
              View Program
              <ArrowUpRight />
            </a>
          </Button>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</Label>
      {children}
    </div>
  );
}
