use anchor_lang::prelude::*;

declare_id!("CpEVMvSsqTjx4Ajo4J7tbVSaqwR7nR5fwGFqMLAQ1ndr");

// Constants (1 SOL = 1_000_000_000 lamports)
const TICKET_PRICE_LAMPORTS: u64 = 11_000_000; // 0.011 SOL
const VAULT_AMOUNT_LAMPORTS: u64 = 10_000_000; // 0.01 SOL per ticket to prize pool
const ADMIN_AMOUNT_LAMPORTS: u64 = 1_000_000; // 0.001 SOL per ticket to admin
const MAX_TICKETS_PER_ROUND: u16 = 1000;
const MAX_TICKETS_PER_TX: u8 = 10;
const MAX_BUYERS_PER_ROUND: usize = 1000; // Maximum buyers per round to prevent account size issues
const ACTIVATION_FEE_LAMPORTS: u64 = 10_000_000; // 0.01 SOL for one-time activation
const SANITY_TEST_TRANSFER_LAMPORTS: u64 = 10_000_000; // 0.01 SOL for sanity test transfer
const ADMIN_WALLET_PUBKEY_STR: &str = "2q79WzkjgEqPoBAWeEP2ih51q6TYp8D9DYWWMeLHK6WP";

// Devnet program ID
const DEVNET_PROGRAM_ID: &str = "CpEVMvSsqTjx4Ajo4J7tbVSaqwR7nR5fwGFqMLAQ1ndr";

// Round duration constants
const ROUND_DURATION_DEVNET_SECONDS: i64 = 120; // 2 minutes for devnet testing
const ROUND_DURATION_MAINNET_SECONDS: i64 = 86_400; // 24 hours for mainnet

// DEV_MODE: When true, rounds last 60 seconds for rapid testing
const DEV_MODE: bool = true;

/// Get round duration based on DEV_MODE flag and cluster
fn get_round_duration() -> i64 {
    if DEV_MODE {
        return 60;
    }
    
    let program_id = crate::ID;
    let devnet_id: Pubkey = DEVNET_PROGRAM_ID.parse().unwrap();
    
    if program_id == devnet_id {
        ROUND_DURATION_DEVNET_SECONDS
    } else {
        ROUND_DURATION_MAINNET_SECONDS
    }
}

fn get_admin_wallet_pubkey() -> Pubkey {
    ADMIN_WALLET_PUBKEY_STR.parse().unwrap()
}

#[program]
pub mod sollottery {
    use super::*;

    /// Activate user wallet - one-time 0.01 SOL fee
    pub fn activate_user(ctx: Context<ActivateUser>) -> Result<()> {
        require!(
            ctx.accounts.admin_wallet.key() == get_admin_wallet_pubkey(),
            LotteryError::InvalidAdminWallet
        );
        
        let user_profile = &mut ctx.accounts.user_profile;
        
        if user_profile.user != Pubkey::default() {
            require!(!user_profile.activated, LotteryError::AlreadyActivated);
        }
        
        // Transfer activation fee to admin wallet
        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.user.key(),
                &ctx.accounts.admin_wallet.key(),
                ACTIVATION_FEE_LAMPORTS,
            ),
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.admin_wallet.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        user_profile.user = ctx.accounts.user.key();
        user_profile.activated = true;
        
        msg!("User {} activated", ctx.accounts.user.key());
        
        Ok(())
    }

    /// Initialize a new round with its registry and vault
    /// Anyone can call this to start Round 1 (or the next round after claim)
    pub fn init_round(ctx: Context<InitRound>, round_number: u64) -> Result<()> {
        let round = &mut ctx.accounts.round;
        let registry = &mut ctx.accounts.ticket_registry;
        let clock = Clock::get()?;
        
        // Enforce round number validation (prevent reuse of old PDAs)
        require!(
            round_number >= 1,
            LotteryError::InvalidRoundNumber
        );
        
        // Initialize Round
        round.round_number = round_number;
        round.start_timestamp = clock.unix_timestamp;
        round.end_timestamp = clock.unix_timestamp + get_round_duration();
        round.winning_number = None;
        round.winner = None;
        round.status = RoundStatus::Active;
        round.bump = ctx.bumps.round;
        
        // Initialize TicketRegistry with Active state and MAX_BUYERS limit
        registry.round_number = round_number;
        registry.state = RoundState::Active;
        registry.total_tickets = 0;
        registry.buyers = Vec::new();
        
        msg!("Initialized TicketRegistry for round {} with state: Active", round_number);
        msg!("Account size: {} bytes (MAX_BUYERS: {})", TicketRegistry::size(MAX_BUYERS_PER_ROUND), MAX_BUYERS_PER_ROUND);
        
        // Initialize the vault PDA (system account for holding SOL)
        let rent = Rent::get()?;
        let min_rent = rent.minimum_balance(0);
        let vault_bump = ctx.bumps.round_vault;
        let round_number_bytes = round_number.to_le_bytes();
        let seeds = &[
            b"vault",
            round_number_bytes.as_ref(),
            &[vault_bump],
        ];
        let signers = &[&seeds[..]];
        
        anchor_lang::solana_program::program::invoke_signed(
            &anchor_lang::solana_program::system_instruction::create_account(
                &ctx.accounts.payer.key(),
                &ctx.accounts.round_vault.key(),
                min_rent,
                0,
                &anchor_lang::solana_program::system_program::ID,
            ),
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.round_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signers,
        )?;
        
        msg!("Initialized round {} with registry and vault", round_number);
        
        Ok(())
    }

    /// Buy tickets - MINIMAL SANITY TEST with SOL transfer
    pub fn buy_tickets(ctx: Context<BuyTickets>, ticket_count: u8) -> Result<()> {
        msg!("=== buy_tickets START ===");
        msg!("ticket_count = {}", ticket_count);
        msg!("buyer = {}", ctx.accounts.buyer.key());
        msg!("vault = {}", ctx.accounts.vault.key());
        msg!("admin_wallet = {}", ctx.accounts.admin_wallet.key());
        
        require!(ticket_count == 1, LotteryError::InvalidTicketCount);
        
        // Verify admin wallet
        require!(
            ctx.accounts.admin_wallet.key() == get_admin_wallet_pubkey(),
            LotteryError::InvalidAdminWallet
        );
        
        // Check buyer balance before transfers
        let buyer_balance_before = ctx.accounts.buyer.lamports();
        let total_needed = VAULT_AMOUNT_LAMPORTS + ADMIN_AMOUNT_LAMPORTS;
        msg!("buyer_balance_before = {}", buyer_balance_before);
        msg!("total_needed = {} (vault: {} + admin: {})", total_needed, VAULT_AMOUNT_LAMPORTS, ADMIN_AMOUNT_LAMPORTS);
        require!(buyer_balance_before >= total_needed, LotteryError::MathOverflow);
        
        // Initialize vault if it doesn't exist (system account)
        let vault_info = ctx.accounts.vault.to_account_info();
        let vault_balance_before = vault_info.lamports();
        msg!("vault_balance_before = {}", vault_balance_before);
        
        if vault_balance_before == 0 {
            msg!("Initializing vault PDA");
            let rent = Rent::get()?;
            let min_rent = rent.minimum_balance(8);
            msg!("vault_min_rent = {}", min_rent);
            let vault_bump = ctx.bumps.vault;
            let seeds = &[b"vault", &[vault_bump][..]];
            let signers = &[&seeds[..]];
            
            anchor_lang::solana_program::program::invoke_signed(
                &anchor_lang::solana_program::system_instruction::create_account(
                    &ctx.accounts.buyer.key(),
                    &vault_info.key(),
                    min_rent,
                    8,
                    &anchor_lang::solana_program::system_program::ID,
                ),
                &[
                    ctx.accounts.buyer.to_account_info(),
                    vault_info.clone(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                signers,
            )?;
            msg!("Vault initialized with {} lamports", min_rent);
        }
        
        // Transfer 0.01 SOL from buyer to vault
        msg!("=== BEFORE vault transfer ===");
        msg!("Transferring {} lamports from buyer to vault", VAULT_AMOUNT_LAMPORTS);
        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.vault.key(),
                VAULT_AMOUNT_LAMPORTS,
            ),
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        msg!("=== AFTER vault transfer ===");
        let vault_balance_after = ctx.accounts.vault.lamports();
        msg!("vault_balance_after = {}", vault_balance_after);
        
        // Transfer 0.001 SOL from buyer to admin
        msg!("=== BEFORE admin transfer ===");
        msg!("Transferring {} lamports from buyer to admin", ADMIN_AMOUNT_LAMPORTS);
        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.admin_wallet.key(),
                ADMIN_AMOUNT_LAMPORTS,
            ),
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.admin_wallet.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        msg!("=== AFTER admin transfer ===");
        let admin_balance_after = ctx.accounts.admin_wallet.lamports();
        msg!("admin_balance_after = {}", admin_balance_after);
        
        let buyer_balance_after = ctx.accounts.buyer.lamports();
        msg!("buyer_balance_after = {}", buyer_balance_after);
        
        // Update ticket registry
        let registry = &mut ctx.accounts.ticket_registry;
        msg!("Using ticket registry PDA: {}", registry.key());
        
        // Initialize registry if it's new
        if registry.round_number == 0 {
            msg!("Initializing ticket registry for round 1");
            registry.round_number = 1;
            registry.state = RoundState::Active;
            registry.total_tickets = 0;
            registry.buyers = Vec::new();
        }
        
        // Enforce state: only allow buying when Active
        require!(
            registry.state == RoundState::Active,
            LotteryError::RoundNotActive
        );
        
        // Enforce MAX_BUYERS limit (account size safety)
        require!(
            registry.buyers.len() < MAX_BUYERS_PER_ROUND || 
            registry.buyers.iter().any(|b| b.buyer == ctx.accounts.buyer.key()),
            LotteryError::MaxBuyersReached
        );
        
        // Enforce MAX_TICKETS limit
        require!(
            registry.total_tickets < MAX_TICKETS_PER_ROUND as u32,
            LotteryError::MaxTicketsReached
        );
        
        // Find or create buyer entry
        let buyer_key = ctx.accounts.buyer.key();
        let mut buyer_found = false;
        
        for buyer_entry in registry.buyers.iter_mut() {
            if buyer_entry.buyer == buyer_key {
                buyer_entry.ticket_count += ticket_count;
                buyer_found = true;
                msg!("Updated existing buyer {} ticket_count to {}", buyer_key, buyer_entry.ticket_count);
                break;
            }
        }
        
        if !buyer_found {
            registry.buyers.push(BuyerEntry {
                buyer: buyer_key,
                ticket_count,
            });
            msg!("Added new buyer {} with ticket_count {}", buyer_key, ticket_count);
        }
        
        // Increment total tickets
        registry.total_tickets += ticket_count as u32;
        msg!("Total tickets after purchase: {}", registry.total_tickets);
        msg!("Registry PDA: {}, Total tickets: {}", registry.key(), registry.total_tickets);
        msg!("=== buy_tickets SUCCESS ===");
        Ok(())
    }

    /// End the current round and select winning number
    pub fn end_round(ctx: Context<EndRound>) -> Result<()> {
        let round = &mut ctx.accounts.round;
        
        require!(round.status == RoundStatus::Active, LotteryError::RoundNotActive);
        
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= round.end_timestamp,
            LotteryError::RoundNotExpired
        );

        let registry = &mut ctx.accounts.ticket_registry;
        require!(registry.total_tickets > 0, LotteryError::NoTicketsSold);
        
        // Enforce state: only allow ending when Active
        require!(
            registry.state == RoundState::Active,
            LotteryError::RoundNotActive
        );
        
        // Ensure round numbers match
        require!(
            registry.round_number == round.round_number,
            LotteryError::RoundNumberMismatch
        );

        // TODO: Winning number selection needs to be updated for buyer-based structure
        // For now, select based on total_tickets for minimal functionality
        let mut combined: u64 = clock.slot;
        for byte in round.round_number.to_le_bytes().iter() {
            combined = combined.wrapping_mul(31).wrapping_add(*byte as u64);
        }
        combined = combined.wrapping_add(clock.unix_timestamp as u64);
        combined = combined.wrapping_add(registry.total_tickets as u64);
        
        // Temporary: use total_tickets as winning number (0-65535 range)
        let winning_number = (combined % 65536) as u16;

        round.winning_number = Some(winning_number);
        round.status = RoundStatus::Ended;
        
        // Update registry state to Ended
        registry.state = RoundState::Ended;
        
        msg!(
            "Round {} ended. Winning number: {} (total tickets: {})",
            round.round_number,
            winning_number,
            registry.total_tickets
        );

        Ok(())
    }

    /// Claim prize - winner can claim anytime after round ends
    pub fn claim_prize(ctx: Context<ClaimPrize>) -> Result<()> {
        let round = &mut ctx.accounts.round;
        let registry = &mut ctx.accounts.ticket_registry;
        
        require!(round.status == RoundStatus::Ended, LotteryError::RoundNotEnded);
        require!(round.winning_number.is_some(), LotteryError::NoWinningNumber);
        
        // Enforce state: only allow claiming when Ended, prevent double claim
        require!(
            registry.state == RoundState::Ended,
            LotteryError::RoundNotEnded
        );
        
        // Ensure round numbers match
        require!(
            registry.round_number == round.round_number,
            LotteryError::RoundNumberMismatch
        );

        let winning_number = round.winning_number.unwrap();
        
        // Verify user owns the winning ticket
        let user_tickets = &ctx.accounts.user_tickets;
        require!(
            user_tickets.ticket_numbers.contains(&winning_number),
            LotteryError::NotWinner
        );

        // Get vault balance
        let vault_balance = ctx.accounts.round_vault.lamports();
        require!(vault_balance > 0, LotteryError::NoPrize);
        
        // Invariant check: vault balance should be >= total_tickets * VAULT_AMOUNT_LAMPORTS
        let expected_vault_min = (registry.total_tickets as u64)
            .checked_mul(VAULT_AMOUNT_LAMPORTS)
            .ok_or(LotteryError::MathOverflow)?;
        msg!(
            "Invariant check: vault_balance={}, expected_min={}, total_tickets={}",
            vault_balance,
            expected_vault_min,
            registry.total_tickets
        );
        require!(
            vault_balance >= expected_vault_min,
            LotteryError::InvalidVaultBalance
        );
        
        // Note: Admin balance check would require admin wallet account, skipping for now
        // Expected admin amount = total_tickets * ADMIN_AMOUNT_LAMPORTS
        let expected_admin_amount = (registry.total_tickets as u64)
            .checked_mul(ADMIN_AMOUNT_LAMPORTS)
            .ok_or(LotteryError::MathOverflow)?;
        msg!(
            "Expected admin amount: {} lamports ({} tickets * {} lamports per ticket)",
            expected_admin_amount,
            registry.total_tickets,
            ADMIN_AMOUNT_LAMPORTS
        );

        // Transfer entire vault balance to winner
        **ctx.accounts.round_vault.to_account_info().try_borrow_mut_lamports()? -= vault_balance;
        **ctx.accounts.winner.to_account_info().try_borrow_mut_lamports()? += vault_balance;

        // Mark round and registry as claimed (prevent double claim)
        round.winner = Some(ctx.accounts.winner.key());
        round.status = RoundStatus::Claimed;
        registry.state = RoundState::Claimed;

        msg!(
            "Prize of {} lamports claimed by {} for round {}",
            vault_balance,
            ctx.accounts.winner.key(),
            round.round_number
        );
        msg!("Registry state set to Claimed, preventing double claim");

        Ok(())
    }
}

// ============ Account Structures ============

/// Round account - stores information about a lottery round
#[account]
pub struct Round {
    pub round_number: u64,
    pub start_timestamp: i64,
    pub end_timestamp: i64,
    pub winning_number: Option<u16>,
    pub winner: Option<Pubkey>,
    pub status: RoundStatus,
    pub bump: u8,
}

impl Round {
    pub const SIZE: usize = 8 + 8 + 8 + 8 + 3 + 33 + 1 + 1;
}

/// Buyer Entry - stores buyer and ticket count
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct BuyerEntry {
    pub buyer: Pubkey,
    pub ticket_count: u8,
}

/// Round State for TicketRegistry lifecycle
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum RoundState {
    Active,
    Ended,
    Claimed,
}

/// Ticket Registry - unified ticket state per round
/// Seeds: ["ticket_registry", round_number.to_le_bytes()]
/// 
/// Account Size Safety Approach:
/// We enforce MAX_BUYERS_PER_ROUND (1000) to prevent account size issues.
/// This approach stores the full buyers Vec for transparency and auditability.
/// Alternative approach (totals + winner only) would save space but lose buyer history.
#[account]
pub struct TicketRegistry {
    pub round_number: u64,
    pub state: RoundState,
    pub total_tickets: u32,
    pub buyers: Vec<BuyerEntry>,
}

impl TicketRegistry {
    pub const BASE_SIZE: usize = 8 + // discriminator
        8 +  // round_number: u64
        1 +  // state: RoundState (enum as u8)
        4 +  // total_tickets: u32
        4;   // Vec length prefix
    
    // Size for Vec<BuyerEntry> where BuyerEntry = 32 (Pubkey) + 1 (u8) = 33 bytes
    // Using MAX_BUYERS_PER_ROUND to enforce account size limits (Approach a: enforce MAX_BUYERS)
    pub fn size(max_buyers: usize) -> usize {
        Self::BASE_SIZE + (max_buyers * 33) // 33 bytes per BuyerEntry
    }
}

/// User Profile - stores activation status
#[account]
pub struct UserProfile {
    pub user: Pubkey,
    pub activated: bool,
}

impl UserProfile {
    pub const SIZE: usize = 8 + 32 + 1;
}

/// User Tickets - stores tickets owned by a user for a specific round
#[account]
pub struct UserTickets {
    pub owner: Pubkey,
    pub round_number: u64,
    pub ticket_numbers: Vec<u16>,
    pub bump: u8,
}

impl UserTickets {
    pub const BASE_SIZE: usize = 8 + 32 + 8 + 4 + 1;
    
    pub fn size(num_tickets: usize) -> usize {
        Self::BASE_SIZE + (num_tickets * 2)
    }
}

// ============ Status Enum ============

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum RoundStatus {
    Active,
    Ended,
    Claimed,
}

// ============ Instruction Contexts ============

#[derive(Accounts)]
pub struct ActivateUser<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        init_if_needed,
        payer = user,
        space = UserProfile::SIZE,
        seeds = [b"user_profile", user.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,
    
    /// CHECK: Admin wallet - verified via constant
    #[account(mut)]
    pub admin_wallet: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(round_number: u64)]
pub struct InitRound<'info> {
    #[account(
        init,
        payer = payer,
        space = Round::SIZE,
        seeds = [b"round", round_number.to_le_bytes().as_ref()],
        bump
    )]
    pub round: Account<'info, Round>,
    
    #[account(
        init,
        payer = payer,
        space = TicketRegistry::size(MAX_BUYERS_PER_ROUND),
        seeds = [b"ticket_registry", round_number.to_le_bytes().as_ref()],
        bump
    )]
    pub ticket_registry: Account<'info, TicketRegistry>,
    
    /// CHECK: Vault PDA - system account for holding SOL
    #[account(
        mut,
        seeds = [b"vault", round_number.to_le_bytes().as_ref()],
        bump
    )]
    pub round_vault: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyTickets<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    /// CHECK: Global vault PDA - system account for holding SOL
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,
    
    /// CHECK: Admin wallet
    #[account(mut)]
    pub admin_wallet: UncheckedAccount<'info>,
    
    /// Ticket registry for round 1
    #[account(
        init_if_needed,
        payer = buyer,
        space = TicketRegistry::size(MAX_BUYERS_PER_ROUND), // Space for up to MAX_BUYERS_PER_ROUND buyers
        seeds = [b"ticket_registry", 1u64.to_le_bytes().as_ref()],
        bump
    )]
    pub ticket_registry: Account<'info, TicketRegistry>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EndRound<'info> {
    #[account(
        mut,
        seeds = [b"round", round.round_number.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,
    
    #[account(
        seeds = [b"ticket_registry", round.round_number.to_le_bytes().as_ref()],
        bump
    )]
    pub ticket_registry: Account<'info, TicketRegistry>,
}

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    #[account(
        mut,
        seeds = [b"round", round.round_number.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,
    
    #[account(
        seeds = [b"ticket_registry", round.round_number.to_le_bytes().as_ref()],
        bump
    )]
    pub ticket_registry: Account<'info, TicketRegistry>,
    
    /// CHECK: Vault PDA for the round
    #[account(
        mut,
        seeds = [b"vault", round.round_number.to_le_bytes().as_ref()],
        bump
    )]
    pub round_vault: UncheckedAccount<'info>,
    
    #[account(
        seeds = [b"user_tickets", round.round_number.to_le_bytes().as_ref(), winner.key().as_ref()],
        bump = user_tickets.bump
    )]
    pub user_tickets: Account<'info, UserTickets>,
    
    #[account(
        mut,
        constraint = winner.key() == user_tickets.owner @ LotteryError::InvalidWinner
    )]
    pub winner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

// ============ Error Codes ============

#[error_code]
pub enum LotteryError {
    #[msg("Invalid ticket count. Must be between 1 and 10.")]
    InvalidTicketCount,
    
    #[msg("Round is not active.")]
    RoundNotActive,
    
    #[msg("Round has not expired yet.")]
    RoundNotExpired,
    
    #[msg("Round has expired.")]
    RoundExpired,
    
    #[msg("Maximum tickets per round reached.")]
    MaxTicketsReached,
    
    #[msg("No tickets were sold in this round.")]
    NoTicketsSold,
    
    #[msg("Round has not ended yet.")]
    RoundNotEnded,
    
    #[msg("No winning number has been set.")]
    NoWinningNumber,
    
    #[msg("You are not the winner of this round.")]
    NotWinner,
    
    #[msg("Invalid winner account.")]
    InvalidWinner,
    
    #[msg("Wallet not activated.")]
    UserNotActivated,
    
    #[msg("Wallet already activated.")]
    AlreadyActivated,
    
    #[msg("Invalid admin wallet address.")]
    InvalidAdminWallet,
    
    #[msg("No prize available to claim.")]
    NoPrize,
    
    #[msg("Mathematical operation overflowed.")]
    MathOverflow,
    
    #[msg("Maximum buyers per round reached.")]
    MaxBuyersReached,
    
    #[msg("Round number mismatch between Round and TicketRegistry.")]
    RoundNumberMismatch,
    
    #[msg("Invalid round number.")]
    InvalidRoundNumber,
    
    #[msg("Invalid vault balance.")]
    InvalidVaultBalance,
}
