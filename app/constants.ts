import { PublicKey } from '@solana/web3.js';

/**
 * PROGRAM_ID - Replace with your deployed program ID
 * This should match the program ID in your Anchor.toml
 */
export const LOTTERY_PROGRAM_ID = new PublicKey('EuLcEdX49Neyk7jhV4FQS9MmP7qpmN5Hw2dAKv1TtmtV');

/**
 * ADMIN_WALLET - Admin wallet address that receives fees and activation fees
 * This matches the ADMIN_WALLET_PUBKEY constant in the program
 */
export const ADMIN_WALLET = new PublicKey('2q79WzkjgEqPoBAWeEP2ih51q6TYp8D9DYWWMeLHK6WP');

// UI Constants
export const TICKET_COUNT = 1000;
export const MAX_BUY_PER_TX = 10;
export const TICKETS_PER_ROW = 50;
export const ROW_COUNT = 20;

// Program Constants (matching on-chain)
export const TICKET_PRICE_SOL = 0.011;
export const VAULT_AMOUNT_SOL = 0.01;
export const ADMIN_AMOUNT_SOL = 0.001;
// Round duration: DEV_MODE = true in program, so 60 seconds for rapid testing
export const ROUND_DURATION_SECONDS = 60; // DEV_MODE = true
export const ROUND_DURATION_DEVNET_SECONDS = 120; // If DEV_MODE = false on devnet
export const ROUND_DURATION_MAINNET_SECONDS = 86400; // 24 hours if DEV_MODE = false on mainnet
