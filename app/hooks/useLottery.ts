import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Round, TicketPosition, RoundStatus } from '../types';
import { getProgram, findActiveRound } from '../utils/program';
import { 
    getRoundPda, 
    getVaultPda 
} from '../utils/pdas';

/**
 * Helper to determine RoundStatus from account data
 * Anchor 0.29.0 returns enums as objects like { active: {} } or { ended: {} }
 */
function getRoundStatusFromAccount(status: any): RoundStatus {
    if (status?.active !== undefined) return RoundStatus.Active;
    if (status?.ended !== undefined) return RoundStatus.Ended;
    if (status?.claimed !== undefined) return RoundStatus.Claimed;
    // Fallback for numeric values
    if (typeof status === 'number') {
        switch (status) {
            case 0: return RoundStatus.Active;
            case 1: return RoundStatus.Ended;
            case 2: return RoundStatus.Claimed;
        }
    }
    return RoundStatus.Active;
}

/**
 * Custom hook for managing lottery state and interactions
 */
export function useLottery() {
    const { connection } = useConnection();
    const wallet = useWallet();
    
    // State - SCALABLE MODEL (no Vec, no iteration)
    // NOTE: TicketPosition PDAs are tracked client-side in LotteryPage component (localStorage)
    const [roundNumber, setRoundNumber] = useState<number | null>(null);
    const [round, setRound] = useState<Round | null>(null);
    const [vaultBalance, setVaultBalance] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Create provider and program instance
    const anchorProvider = useMemo(() => {
        if (!wallet || !wallet.publicKey) return null;
        return new anchor.AnchorProvider(
            connection,
            wallet as any,
            { preflightCommitment: 'processed', commitment: 'confirmed' }
        );
    }, [connection, wallet]);

    const provider = useMemo(() => {
        return getProgram(anchorProvider, connection);
    }, [anchorProvider, connection]);

    // Find and set active round number (READ-ONLY LIFECYCLE)
    // SCALABLE MODEL: Start from round 1 and search forward for active round
    const findActiveRoundNumber = useCallback(async () => {
        if (!provider) return;
        
        setLoading(true);
        setError(null);
        
        try {
            // Start from round 1 (program auto-creates round 1 if none exists)
            const startRound = roundNumber || 1;
            const activeRound = await findActiveRound(provider, startRound);
            
            if (activeRound !== null) {
                setRoundNumber(activeRound);
            } else {
                // No active round found - try round 1 (may not exist yet, will be auto-created on first buy)
                setRoundNumber(1);
            }
        } catch (err: any) {
            console.debug('Error finding active round:', err);
            // On error, default to round 1 (will be auto-created on-chain)
            setRoundNumber(1);
        } finally {
            setLoading(false);
        }
    }, [provider, roundNumber]);

    // Fetch round data - SCALABLE MODEL
    const fetchRound = useCallback(async (roundNum: number) => {
        if (!provider) return;

        try {
            const [roundPda] = getRoundPda(roundNum);
            const roundAccount = await provider.account.round.fetch(roundPda) as any;
            
            const roundData: Round = {
                roundNumber: roundAccount.roundNumber,
                startTimestamp: roundAccount.startTimestamp,
                endTimestamp: roundAccount.endTimestamp,
                totalTickets: roundAccount.totalTickets,
                winningIndex: roundAccount.winningIndex ? roundAccount.winningIndex : null,
                status: getRoundStatusFromAccount(roundAccount.status),
                bump: roundAccount.bump,
            };

            setRound(roundData);
            console.log("[ROUND] Fetched:", {
                roundNumber: roundData.roundNumber.toString(),
                totalTickets: roundData.totalTickets.toString(),
                winningIndex: roundData.winningIndex?.toString() || null,
                status: RoundStatus[roundData.status],
            });
        } catch (err: any) {
            console.debug('Error fetching round:', err);
            if (err.code === 0) {
                // Account not found - normal before first round
                setRound(null);
            } else {
                setError(err.message || 'Failed to fetch round');
            }
        }
    }, [provider]);

    // SCALABLE MODEL: TicketPosition PDAs are tracked client-side only
    // No on-chain iteration possible - frontend stores PDAs in localStorage after purchase

    // Fetch vault balance
    const fetchVaultBalance = useCallback(async (roundNum: number) => {
        try {
            const [vaultPda] = getVaultPda(roundNum);
            const balance = await connection.getBalance(vaultPda);
            setVaultBalance(balance / LAMPORTS_PER_SOL);
        } catch (err: any) {
            // Vault might not exist yet - set to 0
            console.debug('Error fetching vault balance:', err.message);
            setVaultBalance(0);
        }
    }, [connection]);

    // Fetch all data for current round - SCALABLE MODEL
    // READ-ONLY: Only fetches Round and Vault, no TicketPosition iteration
    const fetchAllData = useCallback(async () => {
        if (!provider || roundNumber === null) return;

        await Promise.all([
            fetchRound(roundNumber),
            fetchVaultBalance(roundNumber),
        ]);
    }, [provider, roundNumber, fetchRound, fetchVaultBalance]);

    // Initialize: find active round on mount and when program changes
    useEffect(() => {
        if (provider) {
            findActiveRoundNumber();
        }
    }, [provider]);

    // Fetch data when round number changes
    useEffect(() => {
        if (roundNumber !== null) {
            fetchAllData();
        }
    }, [roundNumber, fetchAllData]);

    // Refresh data periodically
    useEffect(() => {
        if (!roundNumber) return;

        const interval = setInterval(() => {
            fetchAllData();
        }, 10000); // Refresh every 10 seconds

        return () => clearInterval(interval);
    }, [roundNumber, fetchAllData]);

    return {
        roundNumber,
        round,
        vaultBalance,
        loading,
        error,
        provider,
        refresh: fetchAllData,
        findActiveRound: findActiveRoundNumber,
    };
}

