use anchor_lang::prelude::*;

#[derive(InitSpace)]
#[account]
pub struct Campaign {
    pub owner: Pubkey,
    #[max_len(25)]
    pub title: String,
    pub goal: u64,
    pub raised: u64,
    pub end_time: i64,
    pub bump: u8,
    pub withdrawn: bool,
}

#[derive(InitSpace)]
#[account]
pub struct Donation {
    pub campaign: Pubkey,
    pub donor: Pubkey,
    pub amount: u64,
}
