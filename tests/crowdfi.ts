import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Crowdfi } from "../target/types/crowdfi";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("crowdfi", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Crowdfi as Program<Crowdfi>;
  const owner = provider.wallet;

  const nowTs = () => Math.floor(Date.now() / 1000);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const u64Seed = (value: BN) => value.toArrayLike(Buffer, "le", 8);

  const deriveCampaignPda = (ownerPk: PublicKey, campaignId: BN) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("campaign"), ownerPk.toBuffer(), u64Seed(campaignId)],
      program.programId
    )[0];

  const deriveVaultPda = (campaignPk: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), campaignPk.toBuffer()],
      program.programId
    )[0];

  const deriveDonationPda = (campaignPk: PublicKey, donorPk: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("donation"), campaignPk.toBuffer(), donorPk.toBuffer()],
      program.programId
    )[0];

  const airdrop = async (pubkey: PublicKey, sol = 2) => {
    const sig = await provider.connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig, "confirmed");
  };

  const createCampaign = async (campaignId: BN, goalLamports: BN, endTimeTs: BN, title = "Crowd") => {
    const campaign = deriveCampaignPda(owner.publicKey, campaignId);
    const vault = deriveVaultPda(campaign);

    await program.methods
      .createCampaign(campaignId, title, goalLamports, endTimeTs)
      .accounts({
        signer: owner.publicKey,
        campaign,
        vault,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { campaign, vault };
  };

  const expectAnchorError = async (promise: Promise<unknown>, expectedErrorName?: string) => {
    try {
      await promise;
      expect.fail("Expected transaction to fail");
    } catch (e) {
      const err = e as Error;
      if (expectedErrorName) {
        expect(err.message).to.include(expectedErrorName);
      }
    }
  };

  it("Create works", async () => {
    const campaignId = new BN(1001);
    const goal = new BN(500_000_000);
    const endTime = new BN(nowTs() + 15);

    const { campaign } = await createCampaign(campaignId, goal, endTime, "CreateWorks");
    const account = await program.account.campaign.fetch(campaign);

    expect(account.owner.toBase58()).to.equal(owner.publicKey.toBase58());
    expect(account.goal.toString()).to.equal(goal.toString());
    expect(account.raised.toString()).to.equal("0");
    expect(account.withdrawn).to.equal(false);
    expect(account.title).to.equal("CreateWorks");
  });

  it("Duplicate campaign_id fails", async () => {
    const campaignId = new BN(1002);
    const goal = new BN(100_000_000);
    const endTime = new BN(nowTs() + 15);

    await createCampaign(campaignId, goal, endTime, "Dupe");

    const campaign = deriveCampaignPda(owner.publicKey, campaignId);
    const vault = deriveVaultPda(campaign);

    await expectAnchorError(
      program.methods
        .createCampaign(campaignId, "Dupe", goal, endTime)
        .accounts({
          signer: owner.publicKey,
          campaign,
          vault,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    );
  });

  it("Donate works", async () => {
    const donor = Keypair.generate();
    await airdrop(donor.publicKey);

    const campaignId = new BN(1003);
    const goal = new BN(1_000_000_000);
    const endTime = new BN(nowTs() + 20);
    const { campaign, vault } = await createCampaign(campaignId, goal, endTime, "DonateWorks");

    const donation = deriveDonationPda(campaign, donor.publicKey);
    const amount = new BN(200_000_000);

    await program.methods
      .donate(campaignId, amount)
      .accounts({
        donor: donor.publicKey,
        campaign,
        vault,
        donation,
        systemProgram: SystemProgram.programId,
      })
      .signers([donor])
      .rpc();

    const campaignAcc = await program.account.campaign.fetch(campaign);
    const donationAcc = await program.account.donation.fetch(donation);

    expect(campaignAcc.raised.toString()).to.equal(amount.toString());
    expect(donationAcc.amount.toString()).to.equal(amount.toString());
  });

  it("Donate after goal fails", async () => {
    const donor1 = Keypair.generate();
    const donor2 = Keypair.generate();
    await airdrop(donor1.publicKey);
    await airdrop(donor2.publicKey);

    const campaignId = new BN(1004);
    const goal = new BN(300_000_000);
    const endTime = new BN(nowTs() + 20);
    const { campaign, vault } = await createCampaign(campaignId, goal, endTime, "GoalCap");

    const donation1 = deriveDonationPda(campaign, donor1.publicKey);
    await program.methods
      .donate(campaignId, goal)
      .accounts({
        donor: donor1.publicKey,
        campaign,
        vault,
        donation: donation1,
        systemProgram: SystemProgram.programId,
      })
      .signers([donor1])
      .rpc();

    const donation2 = deriveDonationPda(campaign, donor2.publicKey);
    await expectAnchorError(
      program.methods
        .donate(campaignId, new BN(1))
        .accounts({
          donor: donor2.publicKey,
          campaign,
          vault,
          donation: donation2,
          systemProgram: SystemProgram.programId,
        })
        .signers([donor2])
        .rpc(),
      "GoalAlreadyReached"
    );
  });

  it("Donate after end_time fails", async () => {
    const donor = Keypair.generate();
    await airdrop(donor.publicKey);

    const campaignId = new BN(1005);
    const goal = new BN(1_000_000_000);
    const endTime = new BN(nowTs() + 8);
    const { campaign, vault } = await createCampaign(campaignId, goal, endTime, "Ended");

    await sleep(9_000);

    const donation = deriveDonationPda(campaign, donor.publicKey);
    await expectAnchorError(
      program.methods
        .donate(campaignId, new BN(10_000_000))
        .accounts({
          donor: donor.publicKey,
          campaign,
          vault,
          donation,
          systemProgram: SystemProgram.programId,
        })
        .signers([donor])
        .rpc(),
      "CampaignEnded"
    );
  });

  it("Withdraw only once", async () => {
    const donor = Keypair.generate();
    await airdrop(donor.publicKey);

    const campaignId = new BN(1006);
    const goal = new BN(200_000_000);
    const endTime = new BN(nowTs() + 20);
    const { campaign, vault } = await createCampaign(campaignId, goal, endTime, "Withdraw");

    const donation = deriveDonationPda(campaign, donor.publicKey);
    await program.methods
      .donate(campaignId, goal)
      .accounts({
        donor: donor.publicKey,
        campaign,
        vault,
        donation,
        systemProgram: SystemProgram.programId,
      })
      .signers([donor])
      .rpc();

    await program.methods
      .withdraw(campaignId)
      .accounts({
        owner: owner.publicKey,
        campaign,
        vault,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await expectAnchorError(
      program.methods
        .withdraw(campaignId)
        .accounts({
          owner: owner.publicKey,
          campaign,
          vault,
          systemProgram: SystemProgram.programId,
        })
        .rpc(),
      "CampaignAlreadyWithdrawn"
    );
  });

  it("Refund only when failed", async () => {
    const donor = Keypair.generate();
    await airdrop(donor.publicKey);

    const campaignId = new BN(1007);
    const goal = new BN(900_000_000);
    const endTime = new BN(nowTs() + 12);
    const { campaign, vault } = await createCampaign(campaignId, goal, endTime, "RefundGuard");

    const donation = deriveDonationPda(campaign, donor.publicKey);
    await program.methods
      .donate(campaignId, new BN(100_000_000))
      .accounts({
        donor: donor.publicKey,
        campaign,
        vault,
        donation,
        systemProgram: SystemProgram.programId,
      })
      .signers([donor])
      .rpc();

    await expectAnchorError(
      program.methods
        .refund(campaignId)
        .accounts({
          donor: donor.publicKey,
          campaign,
          vault,
          donation,
          systemProgram: SystemProgram.programId,
        })
        .signers([donor])
        .rpc(),
      "CampaignStillActive"
    );
  });

  it("Refund on failed campaign works and double refund fails", async () => {
    const donor = Keypair.generate();
    await airdrop(donor.publicKey);

    const campaignId = new BN(1008);
    const goal = new BN(900_000_000);
    const endTime = new BN(nowTs() + 8);
    const { campaign, vault } = await createCampaign(campaignId, goal, endTime, "RefundOnce");

    const donation = deriveDonationPda(campaign, donor.publicKey);
    await program.methods
      .donate(campaignId, new BN(120_000_000))
      .accounts({
        donor: donor.publicKey,
        campaign,
        vault,
        donation,
        systemProgram: SystemProgram.programId,
      })
      .signers([donor])
      .rpc();

    await sleep(9_000);

    await program.methods
      .refund(campaignId)
      .accounts({
        donor: donor.publicKey,
        campaign,
        vault,
        donation,
        systemProgram: SystemProgram.programId,
      })
      .signers([donor])
      .rpc();

    const donationAcc = await program.account.donation.fetch(donation);
    expect(donationAcc.amount.toString()).to.equal("0");

    await expectAnchorError(
      program.methods
        .refund(campaignId)
        .accounts({
          donor: donor.publicKey,
          campaign,
          vault,
          donation,
          systemProgram: SystemProgram.programId,
        })
        .signers([donor])
        .rpc(),
      "NothingToRefund"
    );
  });

  it("Amount zero is rejected (overflow path uses checked_add)", async () => {
    const donor = Keypair.generate();
    await airdrop(donor.publicKey);

    const campaignId = new BN(1009);
    const goal = new BN(100_000_000);
    const endTime = new BN(nowTs() + 15);
    const { campaign, vault } = await createCampaign(campaignId, goal, endTime, "Amt0");

    const donation = deriveDonationPda(campaign, donor.publicKey);
    await expectAnchorError(
      program.methods
        .donate(campaignId, new BN(0))
        .accounts({
          donor: donor.publicKey,
          campaign,
          vault,
          donation,
          systemProgram: SystemProgram.programId,
        })
        .signers([donor])
        .rpc(),
      "InvalidAmount"
    );
  });
});
