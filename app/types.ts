import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

/**
 * Round account structure matching the NEW scalable on-chain program
 * Fixed-size account with no Vec fields
 */
export interface Round {
    roundNumber: anchor.BN;
    startTimestamp: anchor.BN;
    endTimestamp: anchor.BN;
    totalTickets: anchor.BN; // u64 - total tickets sold in this round
    winningIndex: anchor.BN | null; // Option<u64> - index in total_tickets range (0 to total_tickets-1)
    status: RoundStatus;
    bump: number;
}

/**
 * TicketPosition account structure - proof of ticket ownership
 * Fixed-size account, one per purchase
 * PDA seeds: ["ticket", round.key(), buyer.key(), round.total_tickets.to_le_bytes()]
 */
export interface TicketPosition {
    round: PublicKey; // Reference to the Round PDA
    buyer: PublicKey; // Owner of this ticket position
    startIndex: anchor.BN; // Starting index in the round's ticket sequence (0-based)
    count: number; // Number of tickets in this position (u32)
    claimed: boolean; // Whether this position has been claimed
    bump: number;
}

/**
 * UserProfile account structure matching the on-chain program
 */
export interface UserProfile {
    user: PublicKey;
    activated: boolean;
}

/**
 * Round status enum matching the on-chain program
 */
export enum RoundStatus {
    Active = 0,   // Round is active and accepting tickets
    Ended = 1,    // Round has ended, winner selected
    Claimed = 2,  // Prize has been claimed, round closed
}
