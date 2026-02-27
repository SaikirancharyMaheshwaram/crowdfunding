"use client";

import { BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

import {
  CLUSTER_ENDPOINTS,
  CROWDFI_IDL,
  DEFAULT_PROGRAM_ID,
  type ClusterKind,
  type WalletKey,
  type WalletLike,
  createProgram,
  getAvailableWallets,
  getWalletByKey,
  resolveProgramId,
} from "@/lib/anchor";

export {
  CLUSTER_ENDPOINTS,
  CROWDFI_IDL,
  ClusterKind,
  WalletKey,
  WalletLike,
  getAvailableWallets,
  getWalletByKey,
};
export const CROWDFI_PROGRAM_ID = DEFAULT_PROGRAM_ID;

export type CampaignState = "Active" | "Successful" | "Completed" | "Failed";

export type CampaignView = {
  pubkey: PublicKey;
  owner: PublicKey;
  title: string;
  goalLamports: bigint;
  raisedLamports: bigint;
  endTime: number;
  withdrawn: boolean;
  bump: number;
  state: CampaignState;
  campaignId: bigint;
};

export type CreateCampaignInput = {
  campaignId: bigint;
  title: string;
  goalLamports: bigint;
  endTimeTs: number;
};

export type DonateInput = {
  campaignId: bigint;
  campaignOwner: PublicKey;
  amountLamports: bigint;
};

export type WithdrawInput = {
  campaignId: bigint;
};

export type RefundInput = {
  campaignId: bigint;
  campaignOwner: PublicKey;
};

export type DonationView = {
  pubkey: PublicKey;
  campaign: PublicKey;
  donor: PublicKey;
  amountLamports: bigint;
};

export function txUrl(signature: string, cluster: ClusterKind) {
  return `https://orbmarkets.io/tx/${signature}?cluster=${cluster}&tab=summary`;
}

export function programUrl(cluster: ClusterKind) {
  return `https://explorer.solana.com/address/${CROWDFI_PROGRAM_ID.toBase58()}?cluster=${cluster}`;
}

function campaignIdStorageKey(cluster: ClusterKind) {
  return `crowdfi:campaign-id-map:${cluster}:${CROWDFI_PROGRAM_ID.toBase58()}`;
}

export function loadCampaignIdMap(
  cluster: ClusterKind
): Record<string, string> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(campaignIdStorageKey(cluster));
  return raw ? (JSON.parse(raw) as Record<string, string>) : {};
}

export function saveCampaignId(
  cluster: ClusterKind,
  campaign: PublicKey,
  campaignId: bigint
) {
  if (typeof window === "undefined") return;
  const current = loadCampaignIdMap(cluster);
  const next = { ...current, [campaign.toBase58()]: campaignId.toString() };
  window.localStorage.setItem(
    campaignIdStorageKey(cluster),
    JSON.stringify(next)
  );
}

export function getConnectedWalletAddress(walletKey: WalletKey): string {
  return getWalletByKey(walletKey)?.publicKey?.toBase58() ?? "";
}

export async function connectWallet(walletKey: WalletKey) {
  const wallet = getWalletByKey(walletKey);
  if (!wallet)
    throw new Error(
      `${walletKey === "phantom" ? "Phantom" : "Solflare"} wallet not found`
    );
  const connected = await wallet.connect();
  return connected.publicKey;
}

export async function disconnectWallet(walletKey: WalletKey) {
  const wallet = getWalletByKey(walletKey);
  if (!wallet?.disconnect) return;
  await wallet.disconnect();
}

export function computeCampaignState(campaign: {
  raisedLamports: bigint;
  goalLamports: bigint;
  endTime: number;
  withdrawn: boolean;
}): CampaignState {
  const now = Math.floor(Date.now() / 1000);
  if (campaign.withdrawn) return "Completed";
  if (campaign.raisedLamports >= campaign.goalLamports) return "Successful";
  if (now > campaign.endTime) return "Failed";
  return "Active";
}

export async function fetchCampaigns(
  cluster: ClusterKind = "devnet",
  programId?: string | PublicKey
): Promise<CampaignView[]> {
  const program = createProgram({ cluster, programId });
  const rows = await (
    program.account as {
      campaign: {
        all: () => Promise<Array<{ publicKey: PublicKey; account: unknown }>>;
      };
    }
  ).campaign.all();

  return rows
    .map((row) => {
      const acc = row.account as {
        owner: PublicKey;
        goal: BN;
        raised: BN;
        endTime: BN;
        withdrawn: boolean;
        bump: number;
        title: string;
        campaignId?: BN;
        campaign_id?: BN;
      };

      const goalLamports = BigInt(acc.goal.toString());
      const raisedLamports = BigInt(acc.raised.toString());
      const endTime = Number(acc.endTime.toString());
      const campaignIdBn = acc.campaignId ?? acc.campaign_id ?? new BN(0);

      return {
        pubkey: row.publicKey,
        owner: acc.owner,
        title: acc.title,
        goalLamports,
        raisedLamports,
        endTime,
        withdrawn: acc.withdrawn,
        bump: acc.bump,
        state: computeCampaignState({
          raisedLamports,
          goalLamports,
          endTime,
          withdrawn: acc.withdrawn,
        }),
        campaignId: BigInt(campaignIdBn.toString()),
      } satisfies CampaignView;
    })
    .sort((a, b) => b.endTime - a.endTime);
}

export async function fetchDonations(
  cluster: ClusterKind = "devnet",
  programId?: string | PublicKey
): Promise<DonationView[]> {
  const program = createProgram({ cluster, programId });
  const rows = await (
    program.account as {
      donation: {
        all: () => Promise<Array<{ publicKey: PublicKey; account: unknown }>>;
      };
    }
  ).donation.all();

  return rows.map((row) => {
    const acc = row.account as {
      campaign: PublicKey;
      donor: PublicKey;
      amount: BN;
    };

    return {
      pubkey: row.publicKey,
      campaign: acc.campaign,
      donor: acc.donor,
      amountLamports: BigInt(acc.amount.toString()),
    } satisfies DonationView;
  });
}

export function deriveCampaignPda(
  owner: PublicKey,
  campaignId: bigint,
  programId?: string | PublicKey
) {
  const pid = resolveProgramId(programId);
  const idSeed = new BN(campaignId.toString()).toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("campaign"), owner.toBuffer(), idSeed],
    pid
  )[0];
}

export function deriveVaultPda(
  campaign: PublicKey,
  programId?: string | PublicKey
) {
  const pid = resolveProgramId(programId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), campaign.toBuffer()],
    pid
  )[0];
}

export function deriveDonationPda(
  campaign: PublicKey,
  donor: PublicKey,
  programId?: string | PublicKey
) {
  const pid = resolveProgramId(programId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("donation"), campaign.toBuffer(), donor.toBuffer()],
    pid
  )[0];
}

function getConnectedWallet(wallet: WalletLike) {
  if (!wallet.publicKey) throw new Error("Wallet is not connected");
  return wallet as WalletLike & { publicKey: PublicKey };
}

export async function sendCreateCampaignTx(
  wallet: WalletLike,
  cluster: ClusterKind,
  input: CreateCampaignInput,
  programId?: string | PublicKey
) {
  const connected = getConnectedWallet(wallet);
  const program = createProgram({ cluster, programId, wallet: connected });
  const campaign = deriveCampaignPda(
    connected.publicKey,
    input.campaignId,
    programId
  );
  const vault = deriveVaultPda(campaign, programId);

  const result = program.methods
    .createCampaign(
      new BN(input.campaignId.toString()),
      input.title,
      new BN(input.goalLamports.toString()),
      new BN(input.endTimeTs.toString())
    )
    .accounts({
      signer: connected.publicKey,
      campaign,
      vault,
      systemProgram: SystemProgram.programId,
    })
    .rpc({
      commitment:"confirmed"
    });


  return result;
}

export async function sendDonateTx(
  wallet: WalletLike,
  cluster: ClusterKind,
  input: DonateInput,
  programId?: string | PublicKey
) {
  const connected = getConnectedWallet(wallet);
  const program = createProgram({ cluster, programId, wallet: connected });
  const campaign = deriveCampaignPda(
    input.campaignOwner,
    input.campaignId,
    programId
  );
  const vault = deriveVaultPda(campaign, programId);
  const donation = deriveDonationPda(campaign, connected.publicKey, programId);

  return program.methods
    .donate(
      new BN(input.campaignId.toString()),
      new BN(input.amountLamports.toString())
    )
    .accounts({
      donor: connected.publicKey,
      campaign,
      vault,
      donation,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function sendWithdrawTx(
  wallet: WalletLike,
  cluster: ClusterKind,
  input: WithdrawInput,
  programId?: string | PublicKey
) {
  const connected = getConnectedWallet(wallet);
  const program = createProgram({ cluster, programId, wallet: connected });
  const campaign = deriveCampaignPda(
    connected.publicKey,
    input.campaignId,
    programId
  );
  const vault = deriveVaultPda(campaign, programId);

  return program.methods
    .withdraw(new BN(input.campaignId.toString()))
    .accounts({
      owner: connected.publicKey,
      campaign,
      vault,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function sendRefundTx(
  wallet: WalletLike,
  cluster: ClusterKind,
  input: RefundInput,
  programId?: string | PublicKey
) {
  const connected = getConnectedWallet(wallet);
  const program = createProgram({ cluster, programId, wallet: connected });
  const campaign = deriveCampaignPda(
    input.campaignOwner,
    input.campaignId,
    programId
  );
  const vault = deriveVaultPda(campaign, programId);
  const donation = deriveDonationPda(campaign, connected.publicKey, programId);

  return program.methods
    .refund(new BN(input.campaignId.toString()))
    .accounts({
      donor: connected.publicKey,
      campaign,
      vault,
      donation,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}
