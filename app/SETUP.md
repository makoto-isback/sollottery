# Frontend Setup Instructions

This document explains how to connect the React frontend to your deployed Anchor lottery program.

## Prerequisites

1. Node.js and npm installed
2. Deployed Anchor lottery program
3. Program ID from your deployment

## Installation

```bash
npm install
```

This will install all required dependencies including:
- React and React DOM
- Solana Web3.js
- Anchor SDK
- Solana Wallet Adapter packages

## Configuration

### 1. Update Program ID

Edit `constants.ts` and replace the placeholder program ID:

```typescript
export const LOTTERY_PROGRAM_ID = new PublicKey('YOUR_PROGRAM_ID_HERE');
```

### 2. Update Admin Wallet

Edit `constants.ts` and replace the admin wallet address:

```typescript
export const ADMIN_WALLET = new PublicKey('YOUR_ADMIN_WALLET_ADDRESS');
```

This should match the `ADMIN_WALLET` constant in your Anchor program.

### 3. Update IDL (Optional but Recommended)

The `idl.ts` file contains a TypeScript representation of your program's IDL. For best type safety, you should replace it with the actual IDL generated from your Anchor program:

```bash
# In your Anchor project directory
anchor build
anchor idl parse -f target/idl/sollottery.json -o idl.ts
```

Then copy the generated IDL into `idl.ts`.

### 4. Update Network/Cluster

In `index.tsx`, you can change the network:

```typescript
// For mainnet
const network = WalletAdapterNetwork.Mainnet;

// For devnet (default)
const network = WalletAdapterNetwork.Devnet;

// For localnet
const endpoint = 'http://127.0.0.1:8899';
```

## Running the Application

```bash
npm run dev
```

The application will start on `http://localhost:3000`

## Project Structure

```
sol-lottery/
├── hooks/
│   ├── useLottery.ts              # Hook for fetching lottery state
│   └── useLotteryTransactions.ts  # Hook for lottery transactions
├── utils/
│   ├── pdas.ts                    # PDA derivation utilities
│   └── program.ts                 # Program client setup utilities
├── types.ts                       # TypeScript types matching program accounts
├── constants.ts                   # Constants (Program ID, admin wallet, etc.)
├── idl.ts                         # Program IDL (Interface Definition Language)
├── LotteryPage.tsx                # Main lottery UI component
├── App.tsx                        # App wrapper
└── index.tsx                      # Entry point with wallet provider setup
```

## Key Features

### Wallet Connection
- Supports Phantom and Solflare wallets
- Uses Solana Wallet Adapter for standard wallet integration

### Data Fetching
- Automatically finds the active round
- Fetches round data, ticket registry, user tickets, and vault balance
- Refreshes data every 10 seconds

### Transactions
- **Buy Tickets**: Buy 1-10 tickets per transaction
- **End Round**: Automatically called when countdown reaches zero (or can be manually triggered)
- **Claim Prize**: Available for winners after round ends

### UI Features
- Visual ticket grid (1000 tickets in 10x100 layout)
- Real-time countdown timer
- Prize pool display
- Ticket ownership highlighting
- Winner ticket highlighting

## How It Works

1. **Finding Active Round**: The app searches for rounds starting from round 1, looking for a round with status `Active`.

2. **PDA Derivation**: All accounts use Program Derived Addresses (PDAs) with deterministic seeds:
   - Round: `["round", round_number]`
   - TicketRegistry: `["registry", round_number]`
   - UserTickets: `["user_tickets", round_number, user_pubkey]`
   - Vault: `["vault", round_number]`

3. **Account Fetching**: Once the active round is found, the app fetches:
   - Round account (status, timestamps, winner info)
   - TicketRegistry account (all sold ticket numbers)
   - UserTickets account (for connected wallet)
   - Vault balance (prize pool)

4. **Transactions**: All transactions use Anchor's program interface with proper account derivation and validation.

## Troubleshooting

### "Failed to find active round"
- Ensure your program is deployed
- Check that at least one round has been initialized
- Verify the program ID is correct

### "Account not found" errors
- Make sure the round has been initialized
- Check that the program ID matches your deployment
- Verify you're connected to the correct network

### Wallet connection issues
- Ensure you have a Solana wallet installed (Phantom recommended)
- Check that the wallet is connected to the correct network

### Transaction failures
- Check that your wallet has sufficient SOL
- Verify the admin wallet address is correct
- Ensure the round is in the correct state (active for buying, ended for claiming)

## Development Notes

- The app uses TypeScript for type safety
- All account structures match the on-chain program exactly
- PDA derivation uses the same seeds as the Anchor program
- Error handling is built into all hooks and transaction functions

