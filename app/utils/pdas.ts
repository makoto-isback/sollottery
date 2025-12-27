import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { LOTTERY_PROGRAM_ID } from '../constants';

/**
 * Derive the Round PDA for a given round number
 * Seeds: ["round", round_number.to_le_bytes()]
 */
export function getRoundPda(roundNumber: anchor.BN | number): [PublicKey, number] {
    const roundNum = typeof roundNumber === 'number' ? roundNumber : roundNumber.toNumber();
    const roundBuffer = Buffer.allocUnsafe(8);
    roundBuffer.writeBigUInt64LE(BigInt(roundNum), 0);
    
    return PublicKey.findProgramAddressSync(
        [Buffer.from('round'), roundBuffer],
        LOTTERY_PROGRAM_ID
    );
}

/**
 * Derive the TicketPosition PDA for a purchase
 * Seeds: ["ticket", round_pubkey, buyer_pubkey, start_index.to_le_bytes()]
 * Note: start_index is round.total_tickets at time of purchase (0-based index)
 * Matches on-chain: ["ticket", round.key(), buyer.key(), round.total_tickets.to_le_bytes()]
 */
export function getTicketPositionPda(
    roundPubkey: PublicKey,
    buyerPubkey: PublicKey,
    startIndex: anchor.BN | number
): [PublicKey, number] {
    const startIndexValue = typeof startIndex === 'number' ? startIndex : startIndex.toNumber();
    const startIndexBuffer = Buffer.allocUnsafe(8);
    startIndexBuffer.writeBigUInt64LE(BigInt(startIndexValue), 0);
    
    return PublicKey.findProgramAddressSync(
        [
            Buffer.from('ticket'),
            roundPubkey.toBuffer(),
            buyerPubkey.toBuffer(),
            startIndexBuffer,
        ],
        LOTTERY_PROGRAM_ID
    );
}

/**
 * Derive the Vault PDA for a given round number
 * Seeds: ["vault", round_number.to_le_bytes()]
 */
export function getVaultPda(roundNumber: anchor.BN | number): [PublicKey, number] {
    const roundNum = typeof roundNumber === 'number' ? roundNumber : roundNumber.toNumber();
    const roundBuffer = Buffer.allocUnsafe(8);
    roundBuffer.writeBigUInt64LE(BigInt(roundNum), 0);
    
    return PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), roundBuffer],
        LOTTERY_PROGRAM_ID
    );
}

/**
 * Derive the UserProfile PDA for a user
 * Seeds: ["user_profile", user_pubkey]
 */
export function getUserProfilePda(
    user: PublicKey,
    programId: PublicKey = LOTTERY_PROGRAM_ID
): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [Buffer.from('user_profile'), user.toBuffer()],
        programId
    );
}

