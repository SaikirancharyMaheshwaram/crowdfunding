use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Value Should be greater than zero")]
    InvalidGoal,
    #[msg("My second custom error message")]
    InvalidTitle,
    #[msg("Invalid End Time")]
    InvalidEndTime,
    #[msg("End Time Too Short")]
    DurationTooShort,
}
