use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Invalid goal amount")]
    InvalidGoal,
    #[msg("Invalid title")]
    InvalidTitle,
    #[msg("Invalid end time")]
    InvalidEndTime,
    #[msg("Campaign already ended")]
    CampaignEnded,
    #[msg("Campaign is still active")]
    CampaignStillActive,
    #[msg("Campaign not successful")]
    CampaignNotSuccessful,
    #[msg("Campaign already withdrawn")]
    CampaignAlreadyWithdrawn,
    #[msg("Invalid donation account")]
    InvalidDonationAccount,
    #[msg("Overflow occurred")]
    Overflow,
    #[msg("Duration too short")]
    DurationTooShort,
    #[msg("Duration too long")]
    DurationTooLong,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Campaign goal is already reached")]
    GoalAlreadyReached,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("No funds available to withdraw")]
    NothingToWithdraw,
    #[msg("No donation available to refund")]
    NothingToRefund,
}
