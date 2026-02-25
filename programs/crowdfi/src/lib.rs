use anchor_lang::prelude::*;
pub mod error;
pub mod instructions;
pub mod state;
declare_id!("DfmybnA8gNDbkDVCXwMKjvEKRNmiC4tJirPSb3hxkKuG");
use crate::instructions::*;

#[program]
pub mod crowdfi {

    use super::*;

    pub fn initialize(
        ctx: Context<CompaignAccount>,
        title: String,
        goal: u64,
        end_time: i64,
    ) -> Result<()> {
        Ok(())
    }
}
