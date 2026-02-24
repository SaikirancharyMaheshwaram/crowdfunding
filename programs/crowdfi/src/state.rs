use anchor_lang::prelude::*;

use crate::error::CustomError;

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




