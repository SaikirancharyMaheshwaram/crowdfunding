use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub owner: Pubkey,
    pub goal: u64,
    pub raised: u64,
    pub end_time: i64,
    pub withdrawn: bool,
    pub bump: u8,
    #[max_len(25)]
    pub title: String,
}