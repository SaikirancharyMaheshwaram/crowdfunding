"use client";

import { AnchorProvider, type Idl, Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, clusterApiUrl, type Transaction, type VersionedTransaction } from "@solana/web3.js";

import rawIdl from "@/lib/idl/crowdfi.json";

export const CROWDFI_IDL = rawIdl as Idl;
export const DEFAULT_PROGRAM_ID = new PublicKey(rawIdl.address);

export type ClusterKind = "devnet" | "localnet";
export type WalletKey = "phantom" | "solflare";

export const CLUSTER_ENDPOINTS: Record<ClusterKind, string> = {
  devnet: clusterApiUrl("devnet"),
  localnet: "http://127.0.0.1:8899",
};

export type WalletLike = {
  publicKey: PublicKey | null;
  isPhantom?: boolean;
  isSolflare?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect?: () => Promise<void>;
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>;
  signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>;
};

export function resolveProgramId(programId?: string | PublicKey) {
  if (!programId) return DEFAULT_PROGRAM_ID;
  if (programId instanceof PublicKey) return programId;
  return new PublicKey(programId);
}

export function getConnection(cluster: ClusterKind) {
  return new Connection(CLUSTER_ENDPOINTS[cluster], "confirmed");
}

export function getAvailableWallets() {
  if (typeof window === "undefined") return [] as Array<{ key: WalletKey; label: string; wallet: WalletLike }>;

  const wallets: Array<{ key: WalletKey; label: string; wallet: WalletLike }> = [];

  if (window.solana?.isPhantom) {
    wallets.push({ key: "phantom", label: "Phantom", wallet: window.solana });
  }

  if (window.solflare?.isSolflare) {
    wallets.push({ key: "solflare", label: "Solflare", wallet: window.solflare });
  } else if (window.solana?.isSolflare) {
    wallets.push({ key: "solflare", label: "Solflare", wallet: window.solana });
  }

  return wallets;
}

export function getWalletByKey(walletKey: WalletKey) {
  return getAvailableWallets().find((w) => w.key === walletKey)?.wallet ?? null;
}

const readonlySigner = Keypair.generate().publicKey;

const readOnlyWallet: WalletLike = {
  publicKey: readonlySigner,
  connect: async () => ({ publicKey: readonlySigner }),
  disconnect: async () => undefined,
  signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T) => tx,
  signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]) => txs,
};

export function createProvider(params: { cluster: ClusterKind; wallet?: WalletLike | null }) {
  const wallet: WalletLike & { publicKey: PublicKey } = params.wallet?.publicKey
    ? (params.wallet as WalletLike & { publicKey: PublicKey })
    : (readOnlyWallet as WalletLike & { publicKey: PublicKey });
  return new AnchorProvider(getConnection(params.cluster), wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

export function createProgram(params: {
  cluster: ClusterKind;
  programId?: string | PublicKey;
  wallet?: WalletLike | null;
}) {
  const programId = resolveProgramId(params.programId).toBase58();
  const provider = createProvider({ cluster: params.cluster, wallet: params.wallet });
  const idlWithAddress = { ...CROWDFI_IDL, address: programId } as Idl;
  return new Program(idlWithAddress, provider);
}

declare global {
  interface Window {
    solana?: WalletLike;
    solflare?: WalletLike;
  }
}
