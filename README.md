# Solana Lottery Program

A fully on-chain lottery program built with Anchor framework for Solana.

## Overview

This is a decentralized lottery program where:
- One active round runs at a time
- Each round lasts exactly 24 hours
- Users buy tickets and receive random numbers (1-1000)
- Winner is selected deterministically from sold tickets only
- Entire prize pool goes to the winner
- Next round starts automatically after prize claim

## Key Features

### Ticket System
- **Price**: 0.011 SOL per ticket
  - 0.01 SOL goes to the round vault (prize pool)
  - 0.001 SOL goes directly to admin wallet (fixed address)
- **Max tickets per round**: 1000
- **Max tickets per transaction**: 10
- **Number assignment**: Random numbers (1-1000), users cannot choose

### Round Management
- Rounds run for exactly 24 hours
- Anyone can trigger round end if 24 hours have passed
- Winner is selected deterministically using blockhash, slot, and round data
- Winning number is selected **only from sold tickets**

### Prize System
- Entire vault balance goes to the winner
- Winner can claim prize anytime after round ends
- After claiming, next round starts automatically

### Decentralization
- **No admin controls**: No pause, no force withdraw, no override
- Fully on-chain logic
- Deterministic PDA seeds for all accounts

## Program Structure

### Accounts

1. **Round**: Stores round information
   - Round number, timestamps, status
   - Winning number and winner (set when round ends/claimed)

2. **TicketRegistry**: Stores all sold ticket numbers for a round
   - One registry per round (PDA)

3. **UserTickets**: Stores tickets owned by a user for a specific round
   - One account per user per round (PDA)

4. **RoundVault**: System account (PDA) that holds the prize pool
   - One vault per round

### Instructions

1. **initialize**: Initialize the program and create the first round
   - Creates Round account and RoundVault PDA
   - Called once at deployment

2. **buy_tickets**: Buy 1-10 tickets
   - Validates round is active and not expired
   - Transfers SOL (admin fee + vault amount)
   - Generates random ticket numbers
   - Stores tickets in UserTickets and TicketRegistry

3. **end_round**: End the current round and select winner
   - Can be called by anyone if 24 hours passed
   - Selects winning number deterministically from sold tickets
   - Sets round status to Ended

4. **claim_prize**: Winner claims the prize
   - Verifies caller owns the winning ticket
   - Transfers entire vault balance to winner
   - Automatically starts the next round

## Building and Deployment

```bash
# Build the program
anchor build

# Run tests
anchor test

# Deploy (update Anchor.toml with your cluster settings)
anchor deploy
```

## Important Notes

1. **Admin Wallet**: Update the `ADMIN_WALLET` constant with your actual admin wallet address that will receive fees.

2. **Program ID**: Update the `declare_id!` macro with your actual program ID after deployment.

3. **Randomness**: The program uses deterministic randomness based on:
   - Current slot
   - Buyer's public key
   - Current timestamp
   - Number of tickets sold
   - Round data

4. **Account Sizing**: 
   - UserTickets accounts are pre-allocated for 50 tickets but can grow
   - TicketRegistry accounts are pre-allocated for 1000 tickets
   - Accounts use reallocation when needed (with proper rent handling)

5. **Vault Creation**: Vault PDAs are created during `initialize` and `claim_prize` (for next round). The winner pays rent for the next round's vault when claiming.

## Security Considerations

- All validations are done on-chain
- PDAs use deterministic seeds
- Winner selection is deterministic and cannot be manipulated
- No admin override capabilities
- All transfers use checked arithmetic to prevent overflow

## License

MIT

