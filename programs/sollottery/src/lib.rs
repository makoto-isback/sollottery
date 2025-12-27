use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hashv;
use std::convert::TryInto;

declare_id!("EuLcEdX49Neyk7jhV4FQS9MmP7qpmN5Hw2dAKv1TtmtV");

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
const DEVNET_PROGRAM_ID: &str = "EuLcEdX49Neyk7jhV4FQS9MmP7qpmN5Hw2dAKv1TtmtV";

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


    /// Buy tickets - PURE ON-CHAIN LIFECYCLE with SCALABLE ACCOUNT MODEL
    /// Automatically handles round lifecycle: creates round 1 if needed, ends expired rounds, creates next round
    /// Uses fixed-size TicketPosition accounts - one per purchase, no Vec, no reallocations
    pub fn buy_tickets(ctx: Context<BuyTickets>, round_number: u64, ticket_count: u8) -> Result<()> {
        msg!("=== buy_tickets START (SCALABLE MODEL) ===");
        msg!("round_number = {}", round_number);
        msg!("ticket_count = {}", ticket_count);
        msg!("buyer = {}", ctx.accounts.buyer.key());
        
        require!(ticket_count == 1, LotteryError::InvalidTicketCount);
        
        // Verify admin wallet
        require!(
            ctx.accounts.admin_wallet.key() == get_admin_wallet_pubkey(),
            LotteryError::InvalidAdminWallet
        );
        
        let clock = Clock::get()?;
        let now = clock.unix_timestamp;
        
        // ========== ON-CHAIN LIFECYCLE LOGIC ==========
        // Step 1: Auto-create round if it doesn't exist (AUTONOMOUS LIFECYCLE)
        // init_if_needed will create the account if it doesn't exist
        let current_round = &mut ctx.accounts.current_round;
        
        // Check if round was just created (round_number == 0 means uninitialized)
        // or if requesting a different round number
        if current_round.round_number == 0 || current_round.round_number != round_number {
            msg!("[LIFECYCLE] Auto-creating round {} (current: {})", round_number, current_round.round_number);
            
            // Initialize round with proper values
            current_round.round_number = round_number;
            current_round.start_timestamp = now;
            current_round.end_timestamp = now + get_round_duration();
            current_round.total_tickets = 0;
            current_round.winning_index = None;
            current_round.status = RoundStatus::Active;
            current_round.bump = ctx.bumps.current_round;
            
            // Initialize vault if it doesn't exist
            // SystemAccount constraint ensures vault is owned by SystemProgram, but we need to create it if it doesn't exist
            // Use init_if_needed equivalent for SystemAccount
            if ctx.accounts.current_vault.lamports() == 0 {
                let rent = Rent::get()?;
                let min_rent = rent.minimum_balance(0);
                let vault_bump = ctx.bumps.current_vault;
                let round_number_bytes = round_number.to_le_bytes();
                let seeds = &[b"vault", round_number_bytes.as_ref(), &[vault_bump]];
                
                // Create SystemAccount PDA using invoke_signed
                // Vault is a PDA owned by SystemProgram (system account)
                anchor_lang::solana_program::program::invoke_signed(
                    &anchor_lang::solana_program::system_instruction::create_account(
                        &ctx.accounts.buyer.key(),  // Payer (buyer pays rent)
                        &ctx.accounts.current_vault.key(),  // New account (PDA)
                        min_rent,  // Rent exemption
                        0,  // Data size (system account has no data)
                        &anchor_lang::solana_program::system_program::ID,  // Owner (SystemProgram)
                    ),
                    &[
                        ctx.accounts.buyer.to_account_info(),
                        ctx.accounts.current_vault.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                    &[&seeds[..]],
                )?;
            }
            
            msg!("[LIFECYCLE] Round {} auto-created and active", round_number);
        }
        
        // Step 2: Check if current round is expired or already ended - auto-end/auto-roll (AUTONOMOUS LIFECYCLE)
        if current_round.status == RoundStatus::Active && now >= current_round.end_timestamp {
            msg!("[LIFECYCLE] Current round {} expired, auto-ending", current_round.round_number);
            
            // AUTONOMOUS LIFECYCLE: Auto-end expired round (handles zero-ticket case)
            if current_round.total_tickets == 0 {
                // Zero tickets - end without winner
                current_round.winning_index = None;
                current_round.status = RoundStatus::Ended;
                msg!("[LIFECYCLE] Round {} ended with zero tickets", current_round.round_number);
            } else {
                // Has tickets - compute winning index
                let mut hash: u64 = clock.slot;
                hash = hash.wrapping_mul(31).wrapping_add(now as u64);
                hash = hash.wrapping_mul(31).wrapping_add(current_round.round_number);
                let winning_index = hash % current_round.total_tickets;
                current_round.winning_index = Some(winning_index);
                current_round.status = RoundStatus::Ended;
                msg!("[LIFECYCLE] Round {} ended. Winning index: {}", current_round.round_number, winning_index);
            }
            
            // Round expired - return error indicating frontend should retry with next round
            return Err(LotteryError::RoundExpired.into());
        }
        
        // Step 3: Verify round is active (AUTONOMOUS LIFECYCLE ensures we have an active round)
        // After Step 1, current_round.round_number == round_number, so just check status
        require!(
            current_round.status == RoundStatus::Active,
            LotteryError::RoundNotActive
        );
        
        // ========== TICKET PURCHASE LOGIC (SCALABLE MODEL) ==========
        // Check buyer balance
        let buyer_balance_before = ctx.accounts.buyer.lamports();
        let total_needed = VAULT_AMOUNT_LAMPORTS + ADMIN_AMOUNT_LAMPORTS;
        require!(buyer_balance_before >= total_needed, LotteryError::MathOverflow);
        
        // Enforce hard cap: MAX_TICKETS_PER_ROUND = 1000
        // This prevents round from exceeding capacity
        require!(
            current_round.total_tickets + ticket_count as u64 <= MAX_TICKETS_PER_ROUND as u64,
            LotteryError::RoundSoldOut
        );
        
        // Initialize vault if needed and verify ownership
        if ctx.accounts.current_vault.lamports() == 0 {
            let rent = Rent::get()?;
            let min_rent = rent.minimum_balance(0);
            let vault_bump = ctx.bumps.current_vault;
            let round_number_bytes = round_number.to_le_bytes();
            let seeds = &[b"vault", round_number_bytes.as_ref(), &[vault_bump]];
            
            // Create SystemAccount PDA - vault is owned by SystemProgram
            anchor_lang::solana_program::program::invoke_signed(
                &anchor_lang::solana_program::system_instruction::create_account(
                    &ctx.accounts.buyer.key(),  // Payer (buyer pays rent)
                    &ctx.accounts.current_vault.key(),  // New account (PDA)
                    min_rent,  // Rent exemption
                    0,  // Data size (system account)
                    &anchor_lang::solana_program::system_program::ID,  // Owner (SystemProgram)
                ),
                &[
                    ctx.accounts.buyer.to_account_info(),
                    ctx.accounts.current_vault.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                &[&seeds[..]],
            )?;
        }
        
        // CRITICAL: Verify vault is owned by SystemProgram before transfers
        require!(
            ctx.accounts.current_vault.owner == &anchor_lang::solana_program::system_program::ID,
            LotteryError::InvalidVaultBalance
        );
        
        // Verify vault PDA derivation matches
        let (expected_vault, _) = Pubkey::find_program_address(
            &[b"vault", round_number.to_le_bytes().as_ref()],
            ctx.program_id,
        );
        require!(
            ctx.accounts.current_vault.key() == expected_vault,
            LotteryError::InvalidVaultBalance
        );
        
        // Transfer from buyer (signer) to vault (SystemAccount PDA)
        // Buyer is signer, so use invoke (not invoke_signed)
        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.current_vault.key(),
                VAULT_AMOUNT_LAMPORTS,
            ),
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.current_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        // Transfer to admin
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
        
        // ========== CREATE TICKET POSITION (SCALABLE MODEL) ==========
        // Get start_index from round.total_tickets (before incrementing)
        let start_index = current_round.total_tickets;
        
        // Derive TicketPosition PDA manually
        // Seeds: ["ticket", round.key(), buyer.key(), round.total_tickets.to_le_bytes()]
        let round_key = current_round.key();
        let buyer_key = ctx.accounts.buyer.key();
        let nonce_bytes = start_index.to_le_bytes();
        
        let (expected_pda, bump) = Pubkey::find_program_address(
            &[
                b"ticket",
                round_key.as_ref(),
                buyer_key.as_ref(),
                &nonce_bytes,
            ],
            ctx.program_id,
        );
        
        // Verify the PDA matches what was passed
        require!(
            ctx.accounts.ticket_position.key() == expected_pda,
            LotteryError::InvalidVaultBalance // TODO: Add proper error
        );
        
        // Initialize TicketPosition account using system_instruction (NO direct lamport mutation)
        let ticket_position_info = ctx.accounts.ticket_position.to_account_info();
        let rent = Rent::get()?;
        let min_rent = rent.minimum_balance(TicketPosition::SIZE);
        
        // Create TicketPosition account if it doesn't exist using invoke_signed
        if ticket_position_info.lamports() == 0 {
            // Derive seeds for TicketPosition PDA
            let ticket_seeds = &[
                b"ticket",
                round_key.as_ref(),
                buyer_key.as_ref(),
                &nonce_bytes,
            ];
            
            // Create TicketPosition PDA account using invoke_signed
            // Buyer pays rent, account is owned by program (PDA)
            // Program signs for the PDA using seeds + bump
            anchor_lang::solana_program::program::invoke_signed(
                &anchor_lang::solana_program::system_instruction::create_account(
                    &ctx.accounts.buyer.key(),  // Payer (buyer pays rent)
                    &ctx.accounts.ticket_position.key(),  // New account (PDA)
                    min_rent,  // Rent exemption amount
                    TicketPosition::SIZE as u64,  // Account data size
                    ctx.program_id,  // Owner (program owns the PDA)
                ),
                &[
                    ctx.accounts.buyer.to_account_info(),
                    ticket_position_info.clone(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                &[&[
                    b"ticket",
                    round_key.as_ref(),
                    buyer_key.as_ref(),
                    &nonce_bytes,
                    &[bump],
                ]],
            )?;
        }
        
        // Serialize and write TicketPosition data
        let ticket_position = TicketPosition {
            round: round_key,
            buyer: buyer_key,
            start_index,
            count: ticket_count as u32,
            claimed: false,
            bump,
        };
        
        // Use Anchor's account serialization
        ticket_position.try_serialize(&mut &mut *ticket_position_info.try_borrow_mut_data()?)?;
        
        // Increment round.total_tickets safely (after TicketPosition created)
        current_round.total_tickets = current_round.total_tickets
            .checked_add(ticket_count as u64)
            .ok_or(LotteryError::MathOverflow)?;
        
        msg!("=== buy_tickets SUCCESS ===");
        msg!("Created TicketPosition: start_index={}, count={}, total_tickets={}", 
             start_index, ticket_count, current_round.total_tickets);
        Ok(())
    }

    /// Finalize round - permissionless round finalization (PROOF-BASED, NO LOOPS)
    /// AUTONOMOUS LIFECYCLE: Callable by anyone, handles zero-ticket rounds, never stalls
    /// O(1) complexity - no iteration, no Vec operations
    /// IDEMPOTENT: Can be called multiple times safely (status check prevents re-execution)
    pub fn finalize_round(ctx: Context<FinalizeRound>) -> Result<()> {
        let round = &mut ctx.accounts.round;
        
        // Require round is active (ensures idempotency - can't finalize already-ended round)
        require!(round.status == RoundStatus::Active, LotteryError::RoundNotActive);
        
        let clock = Clock::get()?;
        let now = clock.unix_timestamp;
        
        // Require round has expired (permissionless check)
        require!(
            now >= round.end_timestamp,
            LotteryError::RoundNotExpired // This maps to RoundStillRunning in error codes if needed
        );
        
        // AUTONOMOUS LIFECYCLE: Handle zero-ticket rounds by extending the round
        if round.total_tickets == 0 {
            // Zero tickets - extend the round instead of ending it
            // This prevents dead rounds and keeps the lottery active
            let new_end_timestamp = now + get_round_duration();
            round.end_timestamp = new_end_timestamp;
            // Keep round.status = Active (don't change it)
            // Don't set winning_index (keep as None)
            
            msg!(
                "Round {} extended - no tickets sold, round continues until {}",
                round.round_number,
                new_end_timestamp
            );
            
            return Ok(());
        }
        
        // Compute winning_index using hashv (deterministic, O(1))
        // Use round_number and slot for randomness
        let seed = hashv(&[
            round.round_number.to_le_bytes().as_ref(),
            clock.slot.to_le_bytes().as_ref(),
        ]);
        
        // Extract first 8 bytes as u64 for winning index calculation
        let hash_bytes: [u8; 8] = seed.to_bytes()[..8].try_into().unwrap();
        let winning_index = u64::from_le_bytes(hash_bytes) % round.total_tickets;
        
        // Store winning_index in Round and mark as Ended
        round.winning_index = Some(winning_index);
        round.status = RoundStatus::Ended;
        
        msg!(
            "Round {} finalized. Winning index: {} (out of {} total tickets)",
            round.round_number,
            winning_index,
            round.total_tickets
        );
        
        Ok(())
    }

    /// Claim prize - PROOF-BASED verification using TicketPosition (NO LOOPS)
    /// O(1) complexity - range check only, no iteration
    pub fn claim_prize(ctx: Context<ClaimPrize>) -> Result<()> {
        let round = &mut ctx.accounts.round;
        let ticket_position = &mut ctx.accounts.ticket_position;
        
        // Require round has ended
        require!(round.status == RoundStatus::Ended, LotteryError::RoundNotEnded);
        
        // Require winning_index is set (use same error for now, can add NoWinningIndex later)
        require!(round.winning_index.is_some(), LotteryError::RoundNotEnded);
        
        let winning_index = round.winning_index.unwrap();
        
        // PROOF-BASED VERIFICATION (O(1), no loops, no iteration, no scanning):
        // 1. Verify ticket_position.round matches the round (equivalent to roundNumber check)
        require!(
            ticket_position.round == round.key(),
            LotteryError::RoundNumberMismatch
        );
        
        // 2. Verify ticket_position.buyer matches the signer
        require!(
            ticket_position.buyer == ctx.accounts.winner.key(),
            LotteryError::InvalidWinner
        );
        
        // 3. Verify ticket_position has not been claimed yet
        require!(!ticket_position.claimed, LotteryError::AlreadyActivated);
        
        // 4. Verify winner using O(1) range check: start_index <= winning_index < start_index + count
        let start_index = ticket_position.start_index;
        let count = ticket_position.count as u64;
        let end_index = start_index.checked_add(count).ok_or(LotteryError::MathOverflow)?;
        
        require!(
            winning_index >= start_index && winning_index < end_index,
            LotteryError::NotWinner
        );
        
        msg!(
            "Winner verified: winning_index={}, ticket_position: start={}, count={}, range=[{}, {})",
            winning_index,
            start_index,
            count,
            start_index,
            end_index
        );
        
        // Get vault balance (handle zero-ticket rounds gracefully)
        let vault_balance = ctx.accounts.round_vault.lamports();
        
        // AUTONOMOUS LIFECYCLE: Only transfer if there's a prize (zero-ticket rounds may have no prize)
        // FIXED: Use system_instruction::transfer with invoke_signed for SystemAccount PDA vault
        if vault_balance > 0 {
            // CRITICAL: Verify vault is owned by SystemProgram before transfer
            require!(
                ctx.accounts.round_vault.owner == &anchor_lang::solana_program::system_program::ID,
                LotteryError::InvalidVaultBalance
            );
            
            // Verify vault PDA derivation matches
            let (expected_vault, _) = Pubkey::find_program_address(
                &[b"vault", round.round_number.to_le_bytes().as_ref()],
                ctx.program_id,
            );
            require!(
                ctx.accounts.round_vault.key() == expected_vault,
                LotteryError::InvalidVaultBalance
            );
            
            // Transfer entire vault balance to winner
            // Vault is a SystemAccount PDA owned by SystemProgram, so we must use invoke_signed
            let vault_key = ctx.accounts.round_vault.key();
            let round_num_bytes = round.round_number.to_le_bytes();
            let vault_bump = ctx.bumps.round_vault;
            
            // Transfer using invoke_signed (vault PDA must sign via program)
            anchor_lang::solana_program::program::invoke_signed(
                &anchor_lang::solana_program::system_instruction::transfer(
                    &vault_key,
                    &ctx.accounts.winner.key(),
                    vault_balance,
                ),
                &[
                    ctx.accounts.round_vault.to_account_info(),
                    ctx.accounts.winner.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                &[&[b"vault", round_num_bytes.as_ref(), &[vault_bump]]],
            )?;
            
            msg!(
                "Prize of {} lamports transferred to {}",
                vault_balance,
                ctx.accounts.winner.key()
            );
        } else {
            msg!("No prize to transfer (zero-ticket round)");
        }
        
        // Mark ticket_position as claimed (prevent double claim)
        ticket_position.claimed = true;
        
        // Set round status to Claimed
        round.status = RoundStatus::Claimed;
        
        msg!(
            "Prize of {} lamports claimed by {} for round {}",
            vault_balance,
            ctx.accounts.winner.key(),
            round.round_number
        );
        
        // ========== ON-CHAIN LIFECYCLE: Auto-create next round ==========
        let clock = Clock::get()?;
        let now = clock.unix_timestamp;
        let next_round_num = round.round_number + 1;
        
        msg!("[LIFECYCLE] Auto-creating next round {} after claim", next_round_num);
        
        let next_round = &mut ctx.accounts.next_round;
        
        next_round.round_number = next_round_num;
        next_round.start_timestamp = now;
        next_round.end_timestamp = now + get_round_duration();
        next_round.total_tickets = 0;
        next_round.winning_index = None;
        next_round.status = RoundStatus::Active;
        next_round.bump = ctx.bumps.next_round;
        
        // Initialize next vault
        let rent = Rent::get()?;
        let min_rent = rent.minimum_balance(0);
        let next_vault_bump = ctx.bumps.next_vault;
        let next_round_bytes = next_round_num.to_le_bytes();
        let next_seeds = &[b"vault", next_round_bytes.as_ref(), &[next_vault_bump]];
        let next_signers = &[&next_seeds[..]];
        
        anchor_lang::solana_program::program::invoke_signed(
            &anchor_lang::solana_program::system_instruction::create_account(
                &ctx.accounts.winner.key(),
                &ctx.accounts.next_vault.key(),
                min_rent,
                0,
                &anchor_lang::solana_program::system_program::ID,
            ),
            &[
                ctx.accounts.winner.to_account_info(),
                ctx.accounts.next_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            next_signers,
        )?;
        
        msg!("[LIFECYCLE] Next round {} auto-created and active", next_round_num);

        Ok(())
    }
}

// ============ Account Structures ============

/// Round account - stores information about a lottery round
/// Fixed-size account with no Vec fields
#[account]
pub struct Round {
    pub round_number: u64,
    pub start_timestamp: i64,
    pub end_timestamp: i64,
    pub total_tickets: u64,
    pub winning_index: Option<u64>,  // Index in total_tickets range (0 to total_tickets-1)
    pub status: RoundStatus,
    pub bump: u8,
}

impl Round {
    pub const SIZE: usize = 8 +  // discriminator
        8 +  // round_number: u64
        8 +  // start_timestamp: i64
        8 +  // end_timestamp: i64
        8 +  // total_tickets: u64
        9 +  // winning_index: Option<u64> (1 byte tag + 8 bytes value)
        1 +  // status: RoundStatus (enum as u8)
        1;   // bump: u8
}

/// Ticket Position - tracks a buyer's ticket position in a round
/// Fixed-size account with no Vec fields
/// PDA seeds: ["ticket", round.key().as_ref(), buyer.key().as_ref(), nonce.to_le_bytes()]
#[account]
pub struct TicketPosition {
    pub round: Pubkey,
    pub buyer: Pubkey,
    pub start_index: u64,  // Starting index in the round's ticket sequence (0-based)
    pub count: u32,        // Number of tickets in this position
    pub claimed: bool,     // Whether this position has been claimed
    pub bump: u8,
}

impl TicketPosition {
    pub const SIZE: usize = 8 +  // discriminator
        32 + // round: Pubkey
        32 + // buyer: Pubkey
        8 +  // start_index: u64
        4 +  // count: u32
        1 +  // claimed: bool
        1;   // bump: u8
}

/// User Profile - stores activation status
#[account]
pub struct UserProfile {
    pub user: Pubkey,
    pub activated: bool,
}

impl UserProfile {
    pub const SIZE: usize = 8 +  // discriminator
        32 + // user: Pubkey
        1;   // activated: bool
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
    
    /// CHECK: Vault PDA - SystemAccount for holding SOL
    /// Seeds: ["vault", round_number.to_le_bytes()]
    /// Must be owned by SystemProgram (verified in instruction)
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
#[instruction(round_number: u64)]
pub struct BuyTickets<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    /// Current active round - checked/created/ended automatically
    #[account(
        init_if_needed,
        payer = buyer,
        space = Round::SIZE,
        seeds = [b"round", round_number.to_le_bytes().as_ref()],
        bump
    )]
    pub current_round: Account<'info, Round>,
    
    /// Ticket Position PDA - one per purchase
    /// Seeds: ["ticket", round.key(), buyer.key(), round.total_tickets.to_le_bytes()]
    /// PDA is derived manually in instruction since we need to read current_round.total_tickets
    /// CHECK: Verified PDA derivation in instruction
    #[account(mut)]
    pub ticket_position: UncheckedAccount<'info>,
    
    /// CHECK: Vault PDA for current round - SystemAccount PDA owned by SystemProgram
    /// Seeds: ["vault", round_number.to_le_bytes()]
    /// Must be owned by SystemProgram (verified in instruction)
    #[account(
        mut,
        seeds = [b"vault", round_number.to_le_bytes().as_ref()],
        bump
    )]
    pub current_vault: UncheckedAccount<'info>,
    
    /// CHECK: Admin wallet
    #[account(mut)]
    pub admin_wallet: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeRound<'info> {
    /// Round to finalize - permissionless, anyone can call
    /// NO signer required - permissionless finalization
    #[account(
        mut,
        seeds = [b"round", round.round_number.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,
    
    /// System program for account validation
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    #[account(
        mut,
        seeds = [b"round", round.round_number.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,
    
    /// Ticket Position PDA - proof that user owns winning ticket
    /// Verified using range check: start_index <= winning_index < start_index + count
    #[account(mut)]
    pub ticket_position: Account<'info, TicketPosition>,
    
    /// CHECK: Vault PDA for the round - SystemAccount owned by SystemProgram
    /// Seeds: ["vault", round.round_number.to_le_bytes()]
    /// Must be owned by SystemProgram (verified in instruction)
    #[account(
        mut,
        seeds = [b"vault", round.round_number.to_le_bytes().as_ref()],
        bump
    )]
    pub round_vault: UncheckedAccount<'info>,
    
    /// Next round - auto-created after claim
    #[account(
        init_if_needed,
        payer = winner,
        space = Round::SIZE,
        seeds = [b"round", (round.round_number + 1).to_le_bytes().as_ref()],
        bump
    )]
    pub next_round: Account<'info, Round>,
    
    /// CHECK: Vault PDA for next round - SystemAccount owned by SystemProgram
    /// Seeds: ["vault", (round.round_number + 1).to_le_bytes()]
    /// Must be owned by SystemProgram (verified in instruction)
    #[account(
        mut,
        seeds = [b"vault", (round.round_number + 1).to_le_bytes().as_ref()],
        bump
    )]
    pub next_vault: UncheckedAccount<'info>,
    
    #[account(mut)]
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
    
    #[msg("Round is sold out (1000 ticket cap reached).")]
    RoundSoldOut,
    
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
