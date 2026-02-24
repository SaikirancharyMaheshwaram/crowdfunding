import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Crowdfi } from "../target/types/crowdfi";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

describe("crowdfi", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.crowdfi as Program<Crowdfi>;
  const provider = anchor.getProvider();

  const signer = provider.wallet.publicKey;

  it("initializes a campaign successfully", async () => {
    const [campaignPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("zoro"), signer.toBuffer()],
      program.programId
    );

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("wariezoro"), signer.toBuffer()],
      program.programId
    );

    const title = "My First Campaign";
    const goal = new anchor.BN(1000);
    const endTime = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);

    const tx = await program.methods
      .initialize(title, goal, endTime)
      .accounts({
        signer,
        campaign: campaignPda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log({ tx });

    const campaignAccount = await program.account.campaign.fetch(campaignPda);
    console.log("Campaign:", campaignAccount);

    expect(campaignAccount.title).to.equal(title);
    expect(campaignAccount.goal.toNumber()).to.equal(goal.toNumber());
    expect(campaignAccount.raised.toNumber()).to.equal(0);
    expect(campaignAccount.withdrawn).to.equal(false);
  });

  it("fails with invalid goal", async () => {
    const [campaignPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("zoro"), signer.toBuffer()],
      program.programId
    );
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("wariezoro"), signer.toBuffer()],
      program.programId
    );

    const title = "Invalid Goal";
    const goal = new anchor.BN(0);
    const endTime = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);

    await expect(
      program.methods
        .initialize(title, goal, endTime)
        .accounts({
          signer,
          campaign: campaignPda,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    ).rejects.toThrow();
  });

  it("fails with past end_time", async () => {
    const [campaignPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("zoro"), signer.toBuffer()],
      program.programId
    );
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("wariezoro"), signer.toBuffer()],
      program.programId
    );

    const title = "Past End Time";
    const goal = new anchor.BN(100);
    const endTime = new anchor.BN(Math.floor(Date.now() / 1000) - 10);

    await expect(
      program.methods
        .initialize(title, goal, endTime)
        .accounts({
          signer,
          campaign: campaignPda,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    ).rejects.toThrow();
  });

  it("fails with empty title", async () => {
    const [campaignPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("zoro"), signer.toBuffer()],
      program.programId
    );
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("wariezoro"), signer.toBuffer()],
      program.programId
    );

    const title = "";
    const goal = new anchor.BN(100);
    const endTime = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);

    await expect(
      program.methods
        .initialize(title, goal, endTime)
        .accounts({
          signer,
          campaign: campaignPda,
          vault: vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    ).rejects.toThrow();
  });
});
