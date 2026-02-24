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
        ctx: Context<CompaignAccounts>,
        title: String,
        goal: u64,
        end_time: i64,
    ) -> Result<()> {
        create_campaign(ctx, title, goal, end_time)?;
        Ok(())
    }
}
