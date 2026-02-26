"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Coins,
  Loader2,
  RefreshCw,
  Target,
  Timer,
  Trophy,
  Wallet,
} from "lucide-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type ActionKind = "donate" | "withdraw" | "refund";

const stateBadgeVariant: Record<CampaignState, "default" | "secondary" | "outline" | "destructive"> = {
  Active: "default",
  Successful: "secondary",
  Completed: "outline",
  Failed: "destructive",
};

function lamportsToSol(value: bigint) {
  return Number(value) / LAMPORTS_PER_SOL;
}

function shortPk(value: PublicKey | string) {
  const str = typeof value === "string" ? value : value.toBase58();
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

function parseCampaignId(input: string) {
  const num = Number(input.trim());
  if (!Number.isInteger(num) || num < 0) throw new Error("Campaign ID must be a positive integer");
  return BigInt(num);
}

function campaignIdStorageKey(cluster: ClusterKind, programId: string) {
  return `crowdfi:campaign-id-map:${cluster}:${programId}`;
}

export function CrowdfiDashboard() {
  const [cluster, setCluster] = useState<ClusterKind>("devnet");
  const [walletKey, setWalletKey] = useState<WalletKey>("phantom");
  const [walletPk, setWalletPk] = useState<string>("");
  const [walletCount, setWalletCount] = useState(0);

  const [programIdInput, setProgramIdInput] = useState(CROWDFI_PROGRAM_ID.toBase58());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>("");

  const [status, setStatus] = useState("Ready");
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [campaigns, setCampaigns] = useState<CampaignView[]>([]);
  const [filter, setFilter] = useState<"All" | CampaignState>("All");

  const [createCampaignId, setCreateCampaignId] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createGoalSol, setCreateGoalSol] = useState("");
  const [createDurationHours, setCreateDurationHours] = useState("24");
  const [createNotes, setCreateNotes] = useState("");

  const [campaignIdMap, setCampaignIdMap] = useState<Record<string, string>>({});

  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionKind, setActionKind] = useState<ActionKind>("donate");
  const [actionCampaign, setActionCampaign] = useState<CampaignView | null>(null);
  const [donateAmountSol, setDonateAmountSol] = useState("0.1");

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkCampaign, setLinkCampaign] = useState<CampaignView | null>(null);
  const [linkPendingAction, setLinkPendingAction] = useState<ActionKind>("donate");
  const [linkCampaignIdInput, setLinkCampaignIdInput] = useState("");

  const walletLabel = walletKey === "phantom" ? "Phantom" : "Solflare";

  useEffect(() => {
    const key = campaignIdStorageKey(cluster, programIdInput.trim());
    const raw = localStorage.getItem(key);
    setCampaignIdMap(raw ? (JSON.parse(raw) as Record<string, string>) : {});
  }, [cluster, programIdInput]);

  const persistCampaignId = useCallback(
    (campaignPk: PublicKey, campaignId: bigint) => {
      const key = campaignIdStorageKey(cluster, programIdInput.trim());
      setCampaignIdMap((prev) => {
        const next = { ...prev, [campaignPk.toBase58()]: campaignId.toString() };
        localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    },
    [cluster, programIdInput],
  );

  const refreshWallets = useCallback(() => {
    const options = getAvailableWallets();
    setWalletCount(options.length);
    if (options.length > 0 && !options.some((o) => o.key === walletKey)) setWalletKey(options[0].key);
    setWalletPk(getConnectedWalletAddress(walletKey));
  }, [walletKey]);

  const refreshCampaigns = useCallback(async () => {
    try {
      setLoadingCampaigns(true);
      const data = await fetchCampaigns(cluster, programIdInput.trim());
      setCampaigns(data);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setStatus(`Synced ${data.length} campaign(s)`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to fetch campaigns");
    } finally {
      setLoadingCampaigns(false);
    }
  }, [cluster, programIdInput]);

  useEffect(() => {
    refreshWallets();
    void refreshCampaigns();
  }, [refreshWallets, refreshCampaigns]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => void refreshCampaigns(), 10000);
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

  const explorerHref = cluster === "devnet" ? `https://explorer.solana.com/address/${programIdInput.trim()}?cluster=devnet` : "";

  function getKnownCampaignId(campaign: CampaignView) {
    return campaignIdMap[campaign.pubkey.toBase58()] ?? "";
  }

  function requireWallet() {
    const wallet = getWalletByKey(walletKey);
    if (!wallet?.publicKey) throw new Error(`Connect ${walletLabel} wallet first`);
    return wallet;
  }

  function requireCampaignId(campaign: CampaignView) {
    const value = getKnownCampaignId(campaign);
    if (!value) throw new Error("Campaign ID unknown. Link it once.");
    return parseCampaignId(value);
  }

  async function onConnectWallet() {
    try {
      const pk = await connectWallet(walletKey);
      setWalletPk(pk.toBase58());
      setStatus(`Connected ${walletLabel}: ${shortPk(pk)}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Wallet connection failed");
    }
  }

  async function onDisconnectWallet() {
    try {
      await disconnectWallet(walletKey);
      setWalletPk("");
      setStatus(`${walletLabel} disconnected`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Wallet disconnect failed");
    }
  }

  async function onCreateCampaign() {
    try {
      const wallet = requireWallet();
      const campaignId = createCampaignId.trim() ? parseCampaignId(createCampaignId) : BigInt(Math.floor(Date.now() / 1000));
      const goalLamports = toLamports(createGoalSol);
      const endTimeTs = toEndTimeFromHours(createDurationHours);

      setSubmitting(true);
      setStatus("Submitting create_campaign...");
      const sig = await sendCreateCampaignTx(
        wallet,
        cluster,
        { campaignId, title: createTitle, goalLamports, endTimeTs },
        programIdInput.trim(),
      );

      const campaignPda = deriveCampaignPda(wallet.publicKey as PublicKey, campaignId, programIdInput.trim());
      persistCampaignId(campaignPda, campaignId);
      setStatus(`Created campaign. tx: ${sig}`);
      await refreshCampaigns();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "create_campaign failed");
    } finally {
      setSubmitting(false);
    }
  }

  function openAction(campaign: CampaignView, kind: ActionKind) {
    if (!getKnownCampaignId(campaign)) {
      setLinkCampaign(campaign);
      setLinkPendingAction(kind);
      setLinkCampaignIdInput("");
      setLinkModalOpen(true);
      return;
    }

    setActionCampaign(campaign);
    setActionKind(kind);
    setActionModalOpen(true);
  }

  function onLinkCampaign() {
    if (!linkCampaign) return;
    const campaignId = parseCampaignId(linkCampaignIdInput);
    const derived = deriveCampaignPda(linkCampaign.owner, campaignId, programIdInput.trim());
    if (derived.toBase58() !== linkCampaign.pubkey.toBase58()) {
      throw new Error("Campaign ID does not match this campaign PDA");
    }

    persistCampaignId(linkCampaign.pubkey, campaignId);
    setLinkModalOpen(false);
    setActionCampaign(linkCampaign);
    setActionKind(linkPendingAction);
    setActionModalOpen(true);
  }

  async function onConfirmAction() {
    if (!actionCampaign) return;

    try {
      const wallet = requireWallet();
      const campaignId = requireCampaignId(actionCampaign);
      setSubmitting(true);

      if (actionKind === "donate") {
        setStatus("Submitting donate...");
        const sig = await sendDonateTx(
          wallet,
          cluster,
          {
            campaignId,
            campaignOwner: actionCampaign.owner,
            amountLamports: toLamports(donateAmountSol),
          },
          programIdInput.trim(),
        );
        setStatus(`Donated. tx: ${sig}`);
      }

      if (actionKind === "withdraw") {
        setStatus("Submitting withdraw...");
        const sig = await sendWithdrawTx(wallet, cluster, { campaignId }, programIdInput.trim());
        setStatus(`Withdrawn. tx: ${sig}`);
      }

      if (actionKind === "refund") {
        setStatus("Submitting refund...");
        const sig = await sendRefundTx(
          wallet,
          cluster,
          { campaignId, campaignOwner: actionCampaign.owner },
          programIdInput.trim(),
        );
        setStatus(`Refunded. tx: ${sig}`);
      }

      setActionModalOpen(false);
      await refreshCampaigns();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : `${actionKind} failed`);
    } finally {
      setSubmitting(false);
    }
  }

  const currentWalletPk = walletPk ? new PublicKey(walletPk) : null;

  return (
    <main className="min-h-screen bg-[#faf7f2] px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_25px_70px_-50px_rgba(0,0,0,.55)] lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Badge className="bg-black text-white hover:bg-black" variant="default">Crowdfi Protocol</Badge>
              <h1 className="text-3xl font-semibold tracking-tight lg:text-5xl">Launch. Fund. Settle.</h1>
              <p className="max-w-2xl text-sm text-slate-600 lg:text-base">
                Gumroad-inspired crowdfunding dashboard. Actions are now card-native with dialogs, no manual action forms.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="w-36 space-y-1">
                <Label>Cluster</Label>
                <Select value={cluster} onValueChange={(value) => setCluster(value as ClusterKind)}>
                  <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="devnet">devnet</SelectItem>
                    <SelectItem value="localnet">localnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-40 space-y-1">
                <Label>Wallet</Label>
                <Select value={walletKey} onValueChange={(value) => setWalletKey(value as WalletKey)}>
                  <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phantom">Phantom</SelectItem>
                    <SelectItem value="solflare">Solflare</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" className="bg-white" onClick={refreshWallets}>Detect ({walletCount})</Button>

              {walletPk ? (
                <Button variant="outline" className="bg-white" onClick={onDisconnectWallet}>
                  <Wallet />{shortPk(walletPk)}
                </Button>
              ) : (
                <Button variant="outline" className="bg-white" onClick={onConnectWallet}>
                  <Wallet />Connect {walletLabel}
                </Button>
              )}

              {explorerHref ? (
                <Button className="bg-black text-white hover:bg-slate-800" asChild>
                  <a href={explorerHref} rel="noreferrer" target="_blank">Explorer<ArrowUpRight /></a>
                </Button>
              ) : (
                <Button className="bg-black text-white" disabled>Explorer</Button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <Input className="bg-white" value={programIdInput} onChange={(e) => setProgramIdInput(e.target.value)} placeholder="Program ID" />
            <Button variant="outline" className="bg-white" onClick={refreshCampaigns} disabled={loadingCampaigns}>
              {loadingCampaigns ? <Loader2 className="animate-spin" /> : <RefreshCw />}Sync
            </Button>
            <Button variant={autoRefresh ? "default" : "outline"} className={autoRefresh ? "bg-black text-white hover:bg-slate-800" : "bg-white"} onClick={() => setAutoRefresh((p) => !p)}>
              Auto: {autoRefresh ? "ON" : "OFF"}
            </Button>
          </div>

          <div className="mt-3 text-xs text-slate-600">RPC: {CLUSTER_ENDPOINTS[cluster]}</div>
          <div className="mt-1 text-xs text-slate-700">Status: {status}</div>
          <div className="mt-1 text-xs text-slate-500">Last Sync: {lastSyncedAt || "Never"}</div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={<Target className="size-4" />} label="Campaigns" value={totals.campaigns.toString()} />
            <StatCard icon={<Coins className="size-4" />} label="Raised" value={`${totals.raised.toFixed(2)} SOL`} />
            <StatCard icon={<Trophy className="size-4" />} label="Goal Utilization" value={`${totals.utilization}%`} />
            <StatCard icon={<Timer className="size-4" />} label="Cluster" value={cluster} />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_1.45fr]">
          <Card className="border-black/10 bg-white">
            <CardHeader>
              <CardTitle>Create Campaign</CardTitle>
              <CardDescription>Goal in SOL, duration in hours. Campaign ID auto-generates if blank.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Campaign ID (Optional)"><Input value={createCampaignId} onChange={(e) => setCreateCampaignId(e.target.value)} placeholder="auto if empty" /></Field>
              <Field label="Title"><Input maxLength={25} value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Indie Product Launch" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Goal (SOL)"><Input value={createGoalSol} onChange={(e) => setCreateGoalSol(e.target.value)} placeholder="10" /></Field>
                <Field label="Duration (Hours)"><Input value={createDurationHours} onChange={(e) => setCreateDurationHours(e.target.value)} placeholder="24" /></Field>
              </div>
              <Field label="Notes"><Textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder="Optional notes" /></Field>
            </CardContent>
            <CardFooter className="justify-end bg-slate-50">
              <Button className="bg-black text-white hover:bg-slate-800" onClick={onCreateCampaign} disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : null}Create Campaign
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-black/10 bg-white">
            <CardHeader>
              <CardTitle>Campaigns</CardTitle>
              <CardDescription>Click actions directly from cards. No action detail form needed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex w-56 flex-col gap-2">
                <Label>Filter</Label>
                <Select value={filter} onValueChange={(value) => setFilter(value as "All" | CampaignState)}>
                  <SelectTrigger className="w-full bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Successful">Successful</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {visibleCampaigns.map((campaign) => {
                  const goalNum = Number(campaign.goalLamports || BigInt(1));
                  const progress = Math.min(100, Math.round((Number(campaign.raisedLamports) / goalNum) * 100));
                  const knownCampaignId = getKnownCampaignId(campaign);
                  const isOwner = Boolean(currentWalletPk && currentWalletPk.equals(campaign.owner));
                  const canDonate = campaign.state === "Active";
                  const canWithdraw = campaign.state === "Successful" && isOwner;
                  const canRefund = campaign.state === "Failed";

                  return (
                    <div key={campaign.pubkey.toBase58()} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_-24px_rgba(0,0,0,.35)]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-900">{campaign.title || "Untitled"}</p>
                        <Badge variant={stateBadgeVariant[campaign.state]}>{campaign.state}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Campaign: {shortPk(campaign.pubkey)}</p>
                      <p className="mt-1 text-xs text-slate-500">Owner: {shortPk(campaign.owner)}</p>
                      <p className="mt-1 text-xs text-slate-500">ID: {knownCampaignId || "Unknown (link once)"}</p>

                      <div className="mt-3 h-2 w-full rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-gradient-to-r from-slate-900 to-slate-500" style={{ width: `${progress}%` }} />
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                        <span>{lamportsToSol(campaign.raisedLamports).toFixed(2)} / {lamportsToSol(campaign.goalLamports).toFixed(2)} SOL</span>
                        <span>{new Date(campaign.endTime * 1000).toLocaleDateString()}</span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <Button variant="outline" className="bg-white" disabled={!canDonate || submitting} onClick={() => openAction(campaign, "donate")}>Donate</Button>
                        <Button variant="outline" className="bg-white" disabled={!canWithdraw || submitting} onClick={() => openAction(campaign, "withdraw")}>Withdraw</Button>
                        <Button variant="outline" className="bg-white" disabled={!canRefund || submitting} onClick={() => openAction(campaign, "refund")}>Refund</Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {visibleCampaigns.length === 0 ? <p className="text-sm text-slate-500">No campaigns found.</p> : null}
            </CardContent>
          </Card>
        </section>
      </div>

      <AlertDialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="capitalize">{actionKind} Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              {actionCampaign ? `${actionCampaign.title || "Untitled"} (${shortPk(actionCampaign.pubkey)})` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {actionKind === "donate" ? (
            <div className="space-y-2">
              <Label>Amount (SOL)</Label>
              <Input value={donateAmountSol} onChange={(e) => setDonateAmountSol(e.target.value)} placeholder="0.1" />
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmAction} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Link Campaign ID</AlertDialogTitle>
            <AlertDialogDescription>
              This campaign was created outside this browser. Enter its campaign ID once to enable {linkPendingAction}.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label>Campaign ID</Label>
            <Input value={linkCampaignIdInput} onChange={(e) => setLinkCampaignIdInput(e.target.value)} placeholder="e.g. 1024" />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                try {
                  onLinkCampaign();
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : "Failed to link campaign ID");
                }
              }}
              disabled={submitting}
            >
              Link & Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">{icon}<span>{label}</span></div>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
