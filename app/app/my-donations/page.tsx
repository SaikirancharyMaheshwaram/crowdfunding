"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Wallet } from "lucide-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CLUSTER_ENDPOINTS,
  CROWDFI_PROGRAM_ID,
  type CampaignView,
  type ClusterKind,
  type DonationView,
  type WalletKey,
  connectWallet,
  disconnectWallet,
  fetchCampaigns,
  fetchDonations,
  getAvailableWallets,
  getConnectedWalletAddress,
} from "@/lib/crowdfi-client";

function lamportsToSol(value: bigint) {
  return Number(value) / LAMPORTS_PER_SOL;
}

function shortPk(value: PublicKey | string) {
  const str = typeof value === "string" ? value : value.toBase58();
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

export default function MyDonationsPage() {
  const [cluster, setCluster] = useState<ClusterKind>("devnet");
  const [walletKey, setWalletKey] = useState<WalletKey>("phantom");
  const [walletPk, setWalletPk] = useState("");
  const [programIdInput, setProgramIdInput] = useState(CROWDFI_PROGRAM_ID.toBase58());
  const [status, setStatus] = useState("Connect wallet to load your donations.");
  const [loading, setLoading] = useState(false);

  const [campaigns, setCampaigns] = useState<CampaignView[]>([]);
  const [donations, setDonations] = useState<DonationView[]>([]);

  useEffect(() => {
    setWalletPk(getConnectedWalletAddress(walletKey));
  }, [walletKey]);

  const walletOptionsCount = useMemo(() => getAvailableWallets().length, []);

  const refresh = useCallback(async () => {
    if (!walletPk) return;

    try {
      setLoading(true);
      const [campaignRows, donationRows] = await Promise.all([
        fetchCampaigns(cluster, programIdInput.trim()),
        fetchDonations(cluster, programIdInput.trim()),
      ]);

      const pk = new PublicKey(walletPk);
      setCampaigns(campaignRows);
      setDonations(donationRows.filter((d) => d.donor.equals(pk) && d.amountLamports > BigInt(0)));
      setStatus(`Synced ${donationRows.length} donation records.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to fetch donations");
    } finally {
      setLoading(false);
    }
  }, [cluster, programIdInput, walletPk]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onConnect() {
    try {
      const pk = await connectWallet(walletKey);
      setWalletPk(pk.toBase58());
      setStatus(`Connected: ${shortPk(pk)}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Wallet connection failed");
    }
  }

  async function onDisconnect() {
    try {
      await disconnectWallet(walletKey);
      setWalletPk("");
      setDonations([]);
      setStatus("Wallet disconnected.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Wallet disconnect failed");
    }
  }

  const campaignMap = useMemo(() => {
    const map = new Map<string, CampaignView>();
    for (const campaign of campaigns) map.set(campaign.pubkey.toBase58(), campaign);
    return map;
  }, [campaigns]);

  return (
    <main className="min-h-screen bg-[#f6f2eb] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_25px_80px_-55px_rgba(0,0,0,.45)]">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">My Donations</h1>
          <p className="mt-2 text-sm text-slate-600">Track your Donation PDAs and campaign outcomes in one place.</p>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
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

            <div className="space-y-1 md:col-span-2">
              <Label>Program ID</Label>
              <Input className="bg-white" value={programIdInput} onChange={(e) => setProgramIdInput(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {walletPk ? (
              <Button variant="outline" className="bg-white" onClick={onDisconnect}>
                <Wallet /> {shortPk(walletPk)}
              </Button>
            ) : (
              <Button className="bg-black text-white hover:bg-slate-800" onClick={onConnect}>
                <Wallet /> Connect Wallet
              </Button>
            )}

            <Button variant="outline" className="bg-white" onClick={refresh} disabled={loading || !walletPk}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
            </Button>

            <Badge variant="outline">Wallets Detected: {walletOptionsCount}</Badge>
          </div>

          <p className="mt-3 text-xs text-slate-500">RPC: {CLUSTER_ENDPOINTS[cluster]}</p>
          <p className="mt-1 text-xs text-slate-700">Status: {status}</p>
        </section>

        <Card className="border-black/10 bg-white">
          <CardHeader>
            <CardTitle>Donation Records</CardTitle>
            <CardDescription>Only your non-zero donation balances are shown.</CardDescription>
          </CardHeader>
          <CardContent>
            {donations.length === 0 ? (
              <p className="text-sm text-slate-500">No active donations found for this wallet.</p>
            ) : (
              <div className="space-y-3">
                {donations.map((donation) => {
                  const campaign = campaignMap.get(donation.campaign.toBase58());
                  return (
                    <div key={donation.pubkey.toBase58()} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-slate-900">{campaign?.title || "Campaign"}</p>
                        <Badge variant="outline">{campaign?.state || "Unknown"}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Campaign: {shortPk(donation.campaign)}</p>
                      <p className="mt-1 text-xs text-slate-500">Donation PDA: {shortPk(donation.pubkey)}</p>
                      <p className="mt-2 text-sm text-slate-700">Amount: {lamportsToSol(donation.amountLamports).toFixed(4)} SOL</p>
                      {campaign?.state === "Failed" ? (
                        <p className="mt-2 text-xs text-emerald-700">Refund should be available from Live Funds page action buttons.</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
