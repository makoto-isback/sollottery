# Frontend Integration Summary

This document summarizes the Web3 integration work done to connect the React frontend to the Anchor lottery program.

## Files Created/Modified

### Core Integration Files

1. **types.ts** - Updated with correct TypeScript types matching the on-chain program:
   - `Round` - Round account structure
   - `TicketRegistry` - Ticket registry account structure  
   - `UserTickets` - User tickets account structure
   - `RoundStatus` - Enum matching program (Active, Ended, Claimed)

2. **constants.ts** - Updated with:
   - Program ID (placeholder - needs to be updated)
   - Admin wallet address (placeholder - needs to be updated)
   - UI constants (ticket count, max buy per tx, etc.)

3. **idl.ts** - Created with IDL structure matching the program:
   - Instruction definitions (initialize, buyTickets, endRound, claimPrize)
   - Account definitions (Round, TicketRegistry, UserTickets)
   - Error definitions
   - Note: Should be replaced with actual generated IDL from `anchor idl parse`

### Utility Files

4. **utils/pdas.ts** - PDA derivation functions:
   - `getRoundPda(roundNumber)` - Derive round PDA
   - `getTicketRegistryPda(roundNumber)` - Derive ticket registry PDA
   - `getUserTicketsPda(userPubkey, roundNumber)` - Derive user tickets PDA
   - `getVaultPda(roundNumber)` - Derive vault PDA
   - All use correct seeds matching the program

5. **utils/program.ts** - Program client utilities:
   - `getProvider(connection, wallet)` - Create Anchor provider
   - `getProgram(provider, connection)` - Create program instance
   - `findActiveRound(program, startRound)` - Find active round by searching
   - `getLatestRoundNumber(program, startRound)` - Get latest round number

### Hook Files

6. **hooks/useLottery.ts** - Main lottery state hook:
   - Manages round number, round data, ticket registry, user tickets, vault balance
   - Automatically finds active round on mount
   - Fetches all data for current round
   - Refreshes data every 10 seconds
   - Handles loading and error states

7. **hooks/useLotteryTransactions.ts** - Transaction hooks:
   - `buyTickets(roundNumber, ticketCount)` - Buy tickets transaction
   - `endRound(roundNumber)` - End round transaction
   - `claimPrize(roundNumber)` - Claim prize transaction
   - All include proper account derivation and error handling

### UI Files

8. **LotteryPage.tsx** - Completely rewritten to use the new hooks:
   - Uses `useLottery()` for state management
   - Uses `useLotteryTransactions()` for transactions
   - Displays round info, countdown, prize pool, tickets sold
   - Visual ticket grid with sold/user/winner highlighting
   - Buy tickets functionality with quantity selector
   - Auto-end round when countdown reaches zero
   - Claim prize button for winners
   - Proper loading and error states

9. **App.tsx** - Updated to use LotteryPage instead of LotteryUI

10. **index.tsx** - Updated with wallet adapter providers:
    - ConnectionProvider
    - WalletProvider (Phantom, Solflare)
    - WalletModalProvider
    - Configured for devnet (can be changed to mainnet)

### Configuration

11. **package.json** - Added wallet adapter dependencies:
    - `@solana/wallet-adapter-base`
    - `@solana/wallet-adapter-wallets`

12. **SETUP.md** - Comprehensive setup instructions

## Key Features Implemented

### ✅ Wallet Connection
- Phantom and Solflare wallet support
- Wallet adapter integration
- Connection status display

### ✅ Round State Fetching
- Automatically finds active round
- Fetches round number, start/end timestamps
- Fetches winning number (if round ended)
- Fetches round status

### ✅ Ticket Registry Fetching
- Fetches all sold ticket numbers
- Maps to visual grid (1000 tickets in 10x100 layout)
- Highlights sold tickets

### ✅ User Tickets Fetching
- Fetches tickets owned by connected wallet
- Highlights user's tickets in grid
- Checks if user is winner

### ✅ Vault Balance
- Fetches vault balance for current round
- Displays prize pool in SOL

### ✅ Buy Tickets
- Calls `buy_tickets` instruction
- Supports 1-10 tickets per transaction
- Validates: round active, not sold out, not expired
- Disables buy button when conditions not met

### ✅ End Round
- Auto-calls when countdown reaches zero
- Can be manually triggered (anyone can call)
- Validates 24 hours have passed

### ✅ Claim Prize
- Only enabled if user owns winning ticket
- Calls `claim_prize` instruction
- Disables after claimed
- Automatically starts next round (handled by program)

## PDA Seeds (Matching Program)

All PDAs use deterministic seeds matching the on-chain program:

- **Round**: `["round", round_number.to_le_bytes()]`
- **TicketRegistry**: `["registry", round_number.to_le_bytes()]`
- **UserTickets**: `["user_tickets", round_number.to_le_bytes(), user_pubkey]`
- **Vault**: `["vault", round_number.to_le_bytes()]`

## Account Structure Mapping

TypeScript types match Rust structs exactly:

```typescript
// Round
{
  roundNumber: BN,
  startTimestamp: BN,
  endTimestamp: BN,
  winningNumber: number | null,
  winner: PublicKey | null,
  status: RoundStatus,
  bump: number
}

// TicketRegistry
{
  roundNumber: BN,
  soldTickets: number[],  // Vec<u16>
  bump: number
}

// UserTickets
{
  owner: PublicKey,
  roundNumber: BN,
  ticketNumbers: number[],  // Vec<u16>
  bump: number
}
```

## Instruction Calls

All instructions use correct account derivation:

### buyTickets
- Accounts: round, ticketRegistry, userTickets, adminWallet, roundVault, buyer, systemProgram
- Args: ticketCount (u8)

### endRound
- Accounts: round, ticketRegistry, clock
- Args: none

### claimPrize
- Accounts: round, ticketRegistry, roundVault, userTickets, winner, clock, nextRound, nextRoundVault, systemProgram
- Args: none

## Next Steps

1. **Update Program ID** in `constants.ts` with your deployed program ID
2. **Update Admin Wallet** in `constants.ts` with your admin wallet address
3. **Generate IDL** from your program and replace `idl.ts`:
   ```bash
   anchor idl parse -f target/idl/sollottery.json -o idl.ts
   ```
4. **Test** the integration with your deployed program
5. **Update Network** in `index.tsx` if deploying to mainnet

## Notes

- The UI preserves the black & white theme from the original design
- Tickets are assigned randomly on-chain (users cannot choose numbers)
- Grid is visual only (not clickable)
- All validations match the on-chain program logic
- Error handling is comprehensive with user-friendly messages
- Data refreshes automatically every 10 seconds

