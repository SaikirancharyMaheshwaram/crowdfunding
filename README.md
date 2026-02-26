# Crowdfi — Solana Crowdfunding Protocol

Production URL: [Add your live URL here](https://your-live-url-here.com)

A fully on-chain crowdfunding protocol built on Solana using Anchor.  
Implements deterministic PDAs, escrow vaults, per-donor accounting, and secure withdraw/refund logic.

## Overview

Crowdfi is an all-or-nothing crowdfunding smart contract that:

- Allows users to create fundraising campaigns
- Accepts SOL donations
- Escrows funds in a program-controlled vault
- Allows withdrawal only if funding goal is met
- Allows donor refunds if campaign fails

This project demonstrates:

- PDA-based escrow architecture
- Deterministic account derivation
- Secure SOL transfers using invoke and invoke_signed
- Derived state machine design
- Separation of state and treasury

##  Architecture

Each campaign consists of:

###  Campaign PDA (State Account)

Stores campaign metadata and status fields.

```rust
pub struct Campaign {
    pub owner: Pubkey,
    pub goal: u64,
    pub raised: u64,
    pub end_time: i64,
    pub withdrawn: bool,
    pub bump: u8,
    pub title: String,
}
```

###  Vault PDA (Treasury Account)

- System account
- Holds donated SOL
- Owned by program
- No custom data
- Signs via invoke_signed

Seeds:

```text
["vault", campaign.key()]
```

###  Donation PDA (Per Donor)

Tracks individual donor contribution.

```rust
pub struct Donation {
    pub campaign: Pubkey,
    pub donor: Pubkey,
    pub amount: u64,
}
```

Seeds:

```text
["donation", campaign.key(), donor.key()]
```

##  Campaign State Machine

State is derived, not stored.

###  Active
`raised < goal`  
AND `now <= end_time`  
AND `withdrawn == false`

###  Successful
`raised >= goal`  
AND `withdrawn == false`

###  Completed
`withdrawn == true`

###  Failed
`raised < goal`  
AND `now > end_time`

No enum stored — state is computed from fields.

##  Instructions

###  create_campaign

Creates:

- Campaign PDA
- Vault PDA

Validations:

- `goal > 0`
- `title` length within bounds
- duration within allowed range

Initializes:

- `raised = 0`
- `withdrawn = false`

###  donate

Flow:

- Validate campaign active
- Validate `amount > 0`
- Transfer SOL (`donor → vault`)
- Update `campaign.raised`
- Update or initialize donation PDA

Uses:

- `invoke` (donor signs)

###  withdraw (Owner Only)

Allowed if:

`raised >= goal`  
AND `withdrawn == false`

Flow:

- Validate owner
- Transfer vault → owner
- Set `withdrawn = true`

Uses:

- `invoke_signed` (vault PDA signs)

###  refund (Donor Only)

Allowed if:

`raised < goal`  
AND `now > end_time`

Flow:

- Validate donation account
- `donation.amount > 0`
- Transfer vault → donor
- Set `donation.amount = 0`

Uses:

- `invoke_signed`

##  Security Principles

- Deterministic PDA derivation
- No dynamic resizing of accounts
- Funds isolated in vault PDA
- Double-withdraw protection
- Double-refund protection
- Strict duration bounds
- Explicit overflow protection
- Derived state machine (no inconsistent enums)

##  Project Structure

```text
programs/
  crowdfi/
    src/
      lib.rs
      state/
        campaign.rs
        donation.rs
      instructions/
        create_campaign.rs
        donate.rs
        withdraw.rs
        refund.rs
      errors.rs

app/            ← Next.js frontend
tests/          ← Anchor tests
```

##  Local Development

###  Start local validator

```bash
solana-test-validator
```

###  Build program

```bash
anchor build
```

###  Deploy program

```bash
anchor deploy
```

###  Run tests

```bash
anchor test
```

##  Frontend (Next.js)

The frontend:

- Connects wallet via wallet-adapter
- Derives PDAs using same seeds as program
- Calls Anchor instructions
- Fetches campaign accounts using:

```ts
program.account.campaign.all()
```

Local development:

```bash
cd app
npm run dev
```

##  Tech Stack

- Solana
- Anchor (Rust)
- TypeScript
- Next.js
- Wallet Adapter
- Phantom Wallet

##  Future Improvements

- Platform fee mechanism
- Campaign categories
- NFT reward tiers
- Event indexing
- On-chain counter for campaign IDs
- Devnet deployment
- Production audit pass

##  What This Project Demonstrates

This project demonstrates strong understanding of:

- Solana runtime
- PDA mechanics
- Account validation
- Atomic transactions
- CPI with invoke_signed
- Secure state transitions
- Protocol-level design thinking

##  License

MIT
