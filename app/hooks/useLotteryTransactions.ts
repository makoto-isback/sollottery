import { useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { ADMIN_WALLET } from '../constants';
import { 
    getRoundPda, 
    getVaultPda,
    getTicketPositionPda
} from '../utils/pdas';
import { SystemProgram } from '@solana/web3.js';

/**
 * Custom hook for lottery transactions
 * READ-ONLY for round lifecycle - all lifecycle is handled on-chain
 */
export function useLotteryTransactions(program: Program<any> | null) {
    const { publicKey } = useWallet();

    /**
     * Buy tickets - PURE ON-CHAIN LIFECYCLE
     * Automatically handles round creation, ending, and next round creation on-chain
     * If round expired, will return RoundExpired error - frontend should retry with round_number + 1
     * 
     * NOTE: roundNumber is passed via PDA derivation (seeds), NOT as a method argument.
     * The IDL signature is: buyTickets(ticketCount: u8)
     */
    const buyTickets = useCallback(async (
        roundNumber: number,
        ticketCount: number
    ): Promise<string> => {
        if (!program || !publicKey) {
            throw new Error('Wallet not connected or program not initialized');
        }

        // Derive PDAs using roundNumber
        const [roundPda] = getRoundPda(roundNumber);
        const [vaultPda] = getVaultPda(roundNumber);
        
        // Fetch Round to get current total_tickets (needed for TicketPosition PDA derivation)
        let totalTickets = 0;
        try {
            const roundAccount = await program.account.round.fetch(roundPda) as any;
            totalTickets = roundAccount.totalTickets?.toNumber() || 0;
        } catch (err) {
            // Round doesn't exist yet - will be created by instruction with total_tickets = 0
            console.debug('Round not found, will be auto-created');
        }
        
        // Derive TicketPosition PDA using current total_tickets as nonce
        const [ticketPositionPda] = getTicketPositionPda(roundPda, publicKey, totalTickets);

        console.log("Buying tickets for round:", roundNumber);
        console.log("PDAs derived:", {
            currentRound: roundPda.toBase58(),
            currentVault: vaultPda.toBase58(),
            ticketPosition: ticketPositionPda.toBase58(),
            nonce: totalTickets,
        });

        try {
            // Call buyTickets(roundNumber, ticketCount) - matching IDL signature
            // roundNumber is also passed as instruction argument (in addition to PDA seeds)
            const signature = await program.methods
                .buyTickets(new anchor.BN(roundNumber), ticketCount)
                .accounts({
                    buyer: publicKey,
                    currentRound: roundPda,
                    ticketPosition: ticketPositionPda, // Verified in instruction
                    currentVault: vaultPda,
                    adminWallet: ADMIN_WALLET,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log("Buy tickets successful:", signature);
            return signature;
        } catch (error: any) {
            console.error('Buy tickets error:', error);
            if (error.logs && Array.isArray(error.logs)) {
                console.error('Program logs:');
                error.logs.forEach((log: string, index: number) => {
                    console.error(`  [${index}] ${log}`);
                });
            }
            
            // Check for RoundExpired error (code 6002 from IDL)
            const errorCode = error.code || error.error?.code;
            const errorMsg = error.message || '';
            if (errorCode === 6002 || errorMsg.includes('RoundExpired') || errorMsg.includes('Round has expired')) {
                const roundExpiredError = new Error(errorMsg || 'Round has expired');
                (roundExpiredError as any).code = 'RoundExpired';
                throw roundExpiredError;
            }
            
            throw new Error(error.message || 'Failed to buy tickets');
        }
    }, [program, publicKey]);

    /**
     * Claim prize transaction - PROOF-BASED using TicketPosition
     * User provides TicketPosition PDA as proof of ownership
     */
    const claimPrize = useCallback(async (
        roundNumber: number,
        ticketPositionPubkey: PublicKey // TicketPosition PDA to use as proof
    ): Promise<string> => {
        if (!program || !publicKey) {
            throw new Error('Wallet not connected or program not initialized');
        }

        try {
            const [roundPda] = getRoundPda(roundNumber);
            const [vaultPda] = getVaultPda(roundNumber);
            const nextRoundNum = roundNumber + 1;
            const [nextRoundPda] = getRoundPda(nextRoundNum);
            const [nextVaultPda] = getVaultPda(nextRoundNum);

            console.log("Claiming prize for round:", roundNumber);
            console.log("Using TicketPosition:", ticketPositionPubkey.toBase58());

            const signature = await program.methods
                .claimPrize()
                .accounts({
                    round: roundPda,
                    ticketPosition: ticketPositionPubkey, // Proof of ownership
                    roundVault: vaultPda,
                    nextRound: nextRoundPda,
                    nextVault: nextVaultPda,
                    winner: publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log("Claim prize successful:", signature);
            return signature;
        } catch (error: any) {
            console.error('Claim prize error:', error);
            throw new Error(error.message || 'Failed to claim prize');
        }
    }, [program, publicKey]);

    /**
     * Finalize round - permissionless round finalization
     * Anyone can call this to finalize an expired active round
     * Idempotent - safe to call multiple times
     */
    const finalizeRound = useCallback(async (
        roundNumber: number
    ): Promise<string> => {
        if (!program) {
            throw new Error('Program not initialized');
        }

        try {
            const [roundPda] = getRoundPda(roundNumber);

            console.log("Finalizing round:", roundNumber);

            const signature = await program.methods
                .finalizeRound()
                .accounts({
                    round: roundPda,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log("Finalize round successful:", signature);
            return signature;
        } catch (error: any) {
            console.error('Finalize round error:', error);
            
            // Check if round is already finalized (idempotent check)
            if (error.code === 6003 || error.message?.includes('RoundNotActive') || error.message?.includes('Round is not active')) {
                // Round already finalized - this is OK (idempotent)
                console.log('Round already finalized (idempotent call)');
                return '';
            }
            
            throw new Error(error.message || 'Failed to finalize round');
        }
    }, [program]);

    return {
        buyTickets,
        claimPrize,
        finalizeRound,
    };
}
