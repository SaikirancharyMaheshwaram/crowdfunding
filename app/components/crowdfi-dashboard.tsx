"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Coins,
  HandCoins,
  ListFilter,
  Loader2,
  RefreshCw,
  Target,
  Timer,
  Trophy,
  Wallet,
} from "lucide-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  CLUSTER_ENDPOINTS,
  CROWDFI_PROGRAM_ID,
  type CampaignState,
  type CampaignView,
  type ClusterKind,
  type WalletKey,
  connectWallet,
  deriveCampaignPda,
  disconnectWallet,
  fetchCampaigns,
  getAvailableWallets,
  getConnectedWalletAddress,
  getWalletByKey,
  sendCreateCampaignTx,
  sendDonateTx,
  sendRefundTx,
  sendWithdrawTx,
} from "@/lib/crowdfi-client";

const stateBadgeVariant: Record<CampaignState, "default" | "secondary" | "outline" | "destructive"> = {
  Active: "default",
  Successful: "secondary",
  Completed: "outline",
  Failed: "destructive",
};

function lamportsToSol(value: bigint) {
  return Number(value) / LAMPORTS_PER_SOL;
}

function shortPk(value: PublicKey) {
  const str = value.toBase58();
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

function toEndTimeFromHours(hoursInput: string) {
  const hours = Number(hoursInput);
  if (!Number.isFinite(hours) || hours <= 0) throw new Error("Duration must be greater than 0 hours");
  return Math.floor(Date.now() / 1000 + hours * 60 * 60);
}

function toLamports(solInput: string) {
  const num = Number(solInput);
  if (!Number.isFinite(num) || num <= 0) throw new Error("Amount must be greater than 0");
  return BigInt(Math.round(num * LAMPORTS_PER_SOL));
}

export function CrowdfiDashboard() {
  const [cluster, setCluster] = useState<ClusterKind>("devnet");
  const [walletKey, setWalletKey] = useState<WalletKey>("phantom");
  const [walletPk, setWalletPk] = useState<string>("");
  const [walletCount, setWalletCount] = useState(0);
  const [programIdInput, setProgramIdInput] = useState(CROWDFI_PROGRAM_ID.toBase58());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>("");

  const [status, setStatus] = useState<string>("Ready");
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [campaigns, setCampaigns] = useState<CampaignView[]>([]);
  const [filter, setFilter] = useState<"All" | CampaignState>("All");
  const [selectedCampaignKey, setSelectedCampaignKey] = useState<string>("");

  const [createCampaignId, setCreateCampaignId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createGoalSol, setCreateGoalSol] = useState("");
  const [createDurationHours, setCreateDurationHours] = useState("24");
  const [createNotes, setCreateNotes] = useState("");

  const [actionCampaignId, setActionCampaignId] = useState("");
  const [actionCampaignOwner, setActionCampaignOwner] = useState("");
  const [donateAmountSol, setDonateAmountSol] = useState("");

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.pubkey.toBase58() === selectedCampaignKey),
    [campaigns, selectedCampaignKey],
  );

  const walletLabel = walletKey === "phantom" ? "Phantom" : "Solflare";

  const refreshWallets = useCallback(() => {
    const options = getAvailableWallets();
    setWalletCount(options.length);
    if (options.length > 0 && !options.some((o) => o.key === walletKey)) {
      setWalletKey(options[0].key);
    }
    setWalletPk(getConnectedWalletAddress(walletKey));
  }, [walletKey]);

  useEffect(() => {
    refreshWallets();
  }, [refreshWallets]);

  useEffect(() => {
    if (selectedCampaign) {
      setActionCampaignOwner(selectedCampaign.owner.toBase58());
    }
  }, [selectedCampaign]);

  const refreshCampaigns = useCallback(async () => {
    try {
      setLoadingCampaigns(true);
      const data = await fetchCampaigns(cluster, programIdInput.trim());
      setCampaigns(data);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setStatus(`Synced ${data.length} campaign(s)`);

      if (data.length > 0 && !selectedCampaignKey) {
        setSelectedCampaignKey(data[0].pubkey.toBase58());
      }

      if (selectedCampaignKey && !data.some((c) => c.pubkey.toBase58() === selectedCampaignKey)) {
        setSelectedCampaignKey(data[0]?.pubkey.toBase58() ?? "");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch campaigns";
      setStatus(msg);
    } finally {
      setLoadingCampaigns(false);
    }
  }, [cluster, programIdInput, selectedCampaignKey]);

  useEffect(() => {
    void refreshCampaigns();
  }, [refreshCampaigns]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void refreshCampaigns();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, refreshCampaigns]);

  const visibleCampaigns = useMemo(() => {
    if (filter === "All") return campaigns;
    return campaigns.filter((c) => c.state === filter);
  }, [campaigns, filter]);

  const totals = useMemo(() => {
    const raised = campaigns.reduce((sum, c) => sum + lamportsToSol(c.raisedLamports), 0);
    const goal = campaigns.reduce((sum, c) => sum + lamportsToSol(c.goalLamports), 0);
    return {
      campaigns: campaigns.length,
      raised,
      utilization: goal === 0 ? 0 : Math.round((raised / goal) * 100),
    };
  }, [campaigns]);

  async function onConnectWallet() {
    try {
      const pk = await connectWallet(walletKey);
      setWalletPk(pk.toBase58());
      setStatus(`Connected ${walletLabel}: ${shortPk(pk)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Wallet connection failed";
      setStatus(msg);
    }
  }

  async function onDisconnectWallet() {
    try {
      await disconnectWallet(walletKey);
      setWalletPk("");
      setStatus(`${walletLabel} disconnected`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Wallet disconnect failed";
      setStatus(msg);
    }
  }

  function requireWallet() {
    const wallet = getWalletByKey(walletKey);
    if (!wallet?.publicKey) throw new Error(`Connect ${walletLabel} wallet first`);
    return wallet;
  }

  function parseCampaignId(input: string) {
    const num = Number(input.trim());
    if (!Number.isInteger(num) || num < 0) {
      throw new Error("Campaign ID must be a positive integer");
    }
    return BigInt(num);
  }

  function validateSelectedCampaign(campaignOwner: PublicKey, campaignId: bigint) {
    if (!selectedCampaign) return;
    const derived = deriveCampaignPda(campaignOwner, campaignId, programIdInput.trim()).toBase58();
    if (derived !== selectedCampaign.pubkey.toBase58()) {
      throw new Error("Campaign ID/owner does not match selected campaign");
    }
  }

  async function onCreateCampaign() {
    try {
      const wallet = requireWallet();
      const campaignId = createCampaignId.trim()
        ? parseCampaignId(createCampaignId)
        : BigInt(Math.floor(Date.now() / 1000));
      const goalLamports = toLamports(createGoalSol);
      const endTimeTs = toEndTimeFromHours(createDurationHours);

      setSubmitting(true);
      setStatus("Submitting create_campaign transaction...");
      const sig = await sendCreateCampaignTx(wallet, cluster, {
        campaignId,
        title: createTitle,
        goalLamports,
        endTimeTs,
      }, programIdInput.trim());
      setStatus(`create_campaign tx: ${sig}`);
      await refreshCampaigns();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "create_campaign failed";
      setStatus(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function onDonate() {
    try {
      const wallet = requireWallet();
      const campaignId = parseCampaignId(actionCampaignId);
      const owner = new PublicKey(actionCampaignOwner.trim());
      validateSelectedCampaign(owner, campaignId);

      setSubmitting(true);
      setStatus("Submitting donate transaction...");
      const sig = await sendDonateTx(wallet, cluster, {
        campaignId,
        campaignOwner: owner,
        amountLamports: toLamports(donateAmountSol),
      }, programIdInput.trim());
      setStatus(`donate tx: ${sig}`);
      await refreshCampaigns();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "donate failed";
      setStatus(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function onWithdraw() {
    try {
      const wallet = requireWallet();
      const campaignId = parseCampaignId(actionCampaignId);

      setSubmitting(true);
      setStatus("Submitting withdraw transaction...");
      const sig = await sendWithdrawTx(wallet, cluster, { campaignId }, programIdInput.trim());
      setStatus(`withdraw tx: ${sig}`);
      await refreshCampaigns();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "withdraw failed";
      setStatus(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function onRefund() {
    try {
      const wallet = requireWallet();
      const campaignId = parseCampaignId(actionCampaignId);
      const owner = new PublicKey(actionCampaignOwner.trim());
      validateSelectedCampaign(owner, campaignId);

      setSubmitting(true);
      setStatus("Submitting refund transaction...");
      const sig = await sendRefundTx(
        wallet,
        cluster,
        { campaignId, campaignOwner: owner },
        programIdInput.trim(),
      );
      setStatus(`refund tx: ${sig}`);
      await refreshCampaigns();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "refund failed";
      setStatus(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const explorerHref =
    cluster === "devnet"
      ? `https://explorer.solana.com/address/${programIdInput.trim()}?cluster=devnet`
      : "";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_8%_8%,hsl(194_90%_62%/.15),transparent_34%),radial-gradient(circle_at_90%_8%,hsl(37_98%_55%/.15),transparent_35%),linear-gradient(180deg,hsl(220_20%_99%),hsl(210_33%_98%))] px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200/70 bg-white/75 p-6 shadow-[0_20px_65px_-35px_rgba(14,116,144,.6)] backdrop-blur-sm lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Badge className="bg-cyan-600 text-white hover:bg-cyan-500" variant="default">
                Solana Escrow Crowdfunding
              </Badge>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 lg:text-5xl">
                Crowdfi Protocol Console
              </h1>
              <p className="max-w-2xl text-sm text-slate-600 lg:text-base">
                Multi-wallet and multi-cluster frontend for PDA-based crowdfunding instructions.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-36 space-y-1">
                <Label>Cluster</Label>
                <Select
                  value={cluster}
                  onValueChange={(value) => {
                    setCluster(value as ClusterKind);
                    setStatus(`Cluster switched to ${value}`);
                  }}
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="devnet">devnet</SelectItem>
                    <SelectItem value="localnet">localnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-40 space-y-1">
                <Label>Wallet</Label>
                <Select value={walletKey} onValueChange={(value) => setWalletKey(value as WalletKey)}>
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phantom">Phantom</SelectItem>
                    <SelectItem value="solflare">Solflare</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" className="border-slate-300 bg-white/80" onClick={refreshWallets}>
                Detect Wallets ({walletCount})
              </Button>

              {walletPk ? (
                <Button variant="outline" className="border-slate-300 bg-white/80" onClick={onDisconnectWallet}>
                  <Wallet />
                  {shortPk(new PublicKey(walletPk))}
                </Button>
              ) : (
                <Button variant="outline" className="border-slate-300 bg-white/80" onClick={onConnectWallet}>
                  <Wallet />
                  Connect {walletLabel}
                </Button>
              )}

              {explorerHref ? (
                <Button className="bg-cyan-600 text-white hover:bg-cyan-500" asChild>
                  <a href={explorerHref} rel="noreferrer" target="_blank">
                    Program
                    <ArrowUpRight />
                  </a>
                </Button>
              ) : (
                <Button className="bg-cyan-600 text-white hover:bg-cyan-500" disabled>
                  Program Explorer
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <Input
              className="bg-white"
              value={programIdInput}
              onChange={(e) => setProgramIdInput(e.target.value)}
              placeholder="Program ID"
            />
            <Button variant="outline" className="bg-white" onClick={refreshCampaigns} disabled={loadingCampaigns}>
              {loadingCampaigns ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Sync Now
            </Button>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              className={autoRefresh ? "bg-cyan-600 text-white hover:bg-cyan-500" : "bg-white"}
              onClick={() => setAutoRefresh((prev) => !prev)}
            >
              Auto Refresh: {autoRefresh ? "ON" : "OFF"}
            </Button>
          </div>

          <div className="mt-3 text-xs text-slate-600">RPC: {CLUSTER_ENDPOINTS[cluster]}</div>
          <div className="mt-1 text-xs text-slate-700">Status: {status}</div>
          <div className="mt-1 text-xs text-slate-500">
            Last Sync: {lastSyncedAt || "Never"} | Interval: {autoRefresh ? "10s" : "Manual"}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={<Target className="size-4" />} label="Campaigns" value={totals.campaigns.toString()} />
            <StatCard icon={<Coins className="size-4" />} label="Raised" value={`${totals.raised.toFixed(2)} SOL`} />
            <StatCard icon={<Trophy className="size-4" />} label="Goal Utilization" value={`${totals.utilization}%`} />
            <StatCard icon={<Timer className="size-4" />} label="Cluster" value={cluster} />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <Card className="border-slate-200/80 bg-white/85 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <ListFilter className="size-4 text-cyan-700" />
                Campaign Board
              </CardTitle>
              <CardDescription>Fetched live from selected cluster.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex w-full flex-col gap-2 sm:w-56">
                  <Label>Filter</Label>
                  <Select value={filter} onValueChange={(value) => setFilter(value as "All" | CampaignState)}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="All campaigns" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Successful">Successful</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="bg-slate-900 text-white hover:bg-slate-700" onClick={refreshCampaigns} disabled={loadingCampaigns}>
                  {loadingCampaigns ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                  Refresh
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {visibleCampaigns.map((campaign) => {
                  const progress = Math.min(
                    100,
                    Math.round(
                      (Number(campaign.raisedLamports) / Number(campaign.goalLamports || BigInt(1))) * 100,
                    ),
                  );
                  const isSelected = campaign.pubkey.toBase58() === selectedCampaignKey;
                  return (
                    <button
                      key={campaign.pubkey.toBase58()}
                      className={`rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-cyan-400 bg-cyan-50/80 shadow-[0_10px_35px_-25px_rgba(8,145,178,.6)]"
                          : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/30"
                      }`}
                      onClick={() => {
                        setSelectedCampaignKey(campaign.pubkey.toBase58());
                        setActionCampaignOwner(campaign.owner.toBase58());
                      }}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-900">{campaign.title || "Untitled"}</p>
                        <Badge variant={stateBadgeVariant[campaign.state]}>{campaign.state}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Campaign: {shortPk(campaign.pubkey)}</p>
                      <p className="mt-1 text-xs text-slate-500">Owner: {shortPk(campaign.owner)}</p>
                      <div className="mt-3 h-2 w-full rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-amber-500" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                        <span>
                          {lamportsToSol(campaign.raisedLamports).toFixed(2)} / {lamportsToSol(campaign.goalLamports).toFixed(2)} SOL
                        </span>
                        <span>{new Date(campaign.endTime * 1000).toLocaleString()}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {visibleCampaigns.length === 0 ? <p className="text-sm text-slate-500">No campaigns found.</p> : null}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-slate-200/80 bg-white/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Create Campaign</CardTitle>
                <CardDescription>Calls `create_campaign` and initializes campaign + vault PDAs.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="Campaign ID">
                  <Input placeholder="e.g. 1024" value={createCampaignId} onChange={(e) => setCreateCampaignId(e.target.value)} />
                </Field>
                <Field label="Title">
                  <Input
                    maxLength={25}
                    placeholder="Hackathon Prize Pool"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Goal (SOL)">
                    <Input placeholder="10" value={createGoalSol} onChange={(e) => setCreateGoalSol(e.target.value)} />
                  </Field>
                  <Field label="Duration (Hours)">
                    <Input value={createDurationHours} onChange={(e) => setCreateDurationHours(e.target.value)} />
                  </Field>
                </div>
                <Field label="Notes">
                  <Textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder="Optional local notes" />
                </Field>
              </CardContent>
              <CardFooter className="justify-end bg-slate-50/80">
                <Button className="bg-cyan-600 text-white hover:bg-cyan-500" onClick={onCreateCampaign} disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" /> : null}
                  Create Campaign
                </Button>
              </CardFooter>
            </Card>

            <Card className="border-slate-200/80 bg-white/90 backdrop-blur-sm">
              <CardHeader>
                <CardTitle>Campaign Actions</CardTitle>
                <CardDescription>
                  Use exact campaign ID used at creation. ID is not stored on-chain in current program state.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="Campaign ID">
                  <Input value={actionCampaignId} onChange={(e) => setActionCampaignId(e.target.value)} placeholder="e.g. 1024" />
                </Field>
                <Field label="Campaign Owner (Base58)">
                  <Input value={actionCampaignOwner} onChange={(e) => setActionCampaignOwner(e.target.value)} placeholder="Owner pubkey" />
                </Field>
                <Separator />
                <div className="space-y-2">
                  <Field label="Donate (SOL)">
                    <Input placeholder="0.5" value={donateAmountSol} onChange={(e) => setDonateAmountSol(e.target.value)} />
                  </Field>
                  <Button
                    className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
                    onClick={onDonate}
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 className="animate-spin" /> : <HandCoins />}
                    Donate
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="border-amber-300 text-amber-800 hover:bg-amber-50"
                    onClick={onWithdraw}
                    disabled={submitting}
                  >
                    Withdraw
                  </Button>
                  <Button
                    variant="outline"
                    className="border-rose-300 text-rose-700 hover:bg-rose-50"
                    onClick={onRefund}
                    disabled={submitting}
                  >
                    Refund
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
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

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
