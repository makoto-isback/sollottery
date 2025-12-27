import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey } from '@solana/web3.js';
import { RoundStatus, TicketPosition } from './types';
import { useLottery } from './hooks/useLottery';
import { useLotteryTransactions } from './hooks/useLotteryTransactions';
import { getRoundPda, getTicketPositionPda } from './utils/pdas';

const LotteryPage: React.FC = () => {
    const { publicKey, connected } = useWallet();
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedTicketPosition, setSelectedTicketPosition] = useState<PublicKey | null>(null);
    const [ownedTicketPositions, setOwnedTicketPositions] = useState<{pda: PublicKey, round: number, startIndex: number, count: number}[]>([]);
    const isFinalizingRef = useRef(false); // Guard to prevent spam finalize calls
    
    // Load TicketPosition PDAs from localStorage on mount (client-side persistence)
    useEffect(() => {
        if (publicKey) {
            const stored = localStorage.getItem(`ticketPositions_${publicKey.toBase58()}`);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed)) {
                        const positions = parsed.map((p: any) => ({
                            ...p,
                            pda: new PublicKey(p.pda),
                        }));
                        setOwnedTicketPositions(positions);
                    }
                } catch (err) {
                    console.debug('Error loading stored ticket positions:', err);
                }
            }
        }
    }, [publicKey]);
    
    // Reset selected ticket position when round changes
    useEffect(() => {
        setSelectedTicketPosition(null);
    }, [roundNumber]);
    
    // Use our custom hooks - SCALABLE MODEL (READ-ONLY LIFECYCLE)
    const {
        roundNumber,
        round,
        vaultBalance,
        loading,
        error,
        provider,
        refresh,
        findActiveRound,
    } = useLottery();

    const { buyTickets, claimPrize, finalizeRound } = useLotteryTransactions(provider);

    // canBuy calculation - FIXED: Allow buying when round doesn't exist (auto-creates on first buy)
    // Enabled when: wallet.connected && not processing && (no round OR round.status === Active)
    const canBuy = useMemo(() => {
        const hasActiveRound = !round || round.status === RoundStatus.Active;
        const result = connected && hasActiveRound && !isProcessing;
        console.log("[BUY] canBuy =", result, { connected, hasRound: !!round, status: round?.status, isProcessing });
        return result;
    }, [connected, round, isProcessing]);
    
    // Calculate remaining tickets for display and button disabling
    const remainingTickets = useMemo(() => {
        if (!round) return 1000; // No round yet - full capacity available
        const sold = round.totalTickets?.toNumber() || 0;
        return Math.max(0, 1000 - sold);
    }, [round]);
    
    // Helper function to check if a specific ticket count can be purchased
    const canBuyCount = useCallback((count: number) => {
        if (!canBuy) return false;
        return remainingTickets >= count;
    }, [canBuy, remainingTickets]);

    // Calculate countdown from on-chain timestamps (source of truth)
    // VISUAL ONLY - no transactions triggered
    const countdownData = useMemo(() => {
        if (!round) {
            return { remaining: 0, endTs: 0, startTs: 0 };
        }

        // Source of truth: on-chain endTimestamp
        const endTs = round.endTimestamp.toNumber();
        const now = Math.floor(Date.now() / 1000);
        const remaining = Math.max(0, endTs - now);

        console.log(`📊 [COUNTDOWN] Round ${round.roundNumber.toString()}: endTs=${endTs}, now=${now}, remaining=${remaining}s`);
        
        return { remaining, endTs, startTs: round.startTimestamp.toNumber() };
    }, [round]);

    // Update timeLeft display and auto-finalize expired rounds
    useEffect(() => {
        setTimeLeft(countdownData.remaining);
        
        // Update countdown every second (visual only)
        if (countdownData.endTs > 0) {
            const interval = setInterval(() => {
                const now = Math.floor(Date.now() / 1000);
                const remaining = Math.max(0, countdownData.endTs - now);
                setTimeLeft(remaining);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [countdownData]);

    // AUTO-FINALIZE: Automatically call finalizeRound when countdown reaches 0 and round is Active
    // Guarded with ref to prevent spam calls - call exactly ONCE per expired round
    useEffect(() => {
        const autoFinalize = async () => {
            // Conditions: round exists, is Active, countdown reached 0, not already processing, not already finalizing
            if (
                round &&
                round.status === RoundStatus.Active &&
                countdownData.remaining === 0 &&
                !isProcessing &&
                !isFinalizingRef.current &&
                roundNumber
            ) {
                // Prevent multiple simultaneous calls
                if (isFinalizingRef.current) {
                    return;
                }
                
                isFinalizingRef.current = true;
                console.log('🔄 [AUTO-FINALIZE] Countdown reached 0, round is Active - finalizing...');
                
                try {
                    await finalizeRound(roundNumber);
                    console.log('✅ [AUTO-FINALIZE] Round finalized successfully');
                    
                    // Refetch round state after finalization
                    await refresh();
                    
                    // Note: If round was extended (still Active with 0 tickets),
                    // the countdown will automatically update from the new endTimestamp
                    // via the countdownData useMemo hook that depends on round.endTimestamp
                } catch (error: any) {
                    // Idempotent check - if round already finalized, that's OK
                    if (error.message?.includes('already finalized') || 
                        error.code === 'RoundNotActive' ||
                        error.message?.includes('RoundNotActive')) {
                        console.log('ℹ️ [AUTO-FINALIZE] Round already finalized (idempotent)');
                        // Refetch anyway to get updated state
                        await refresh();
                    } else {
                        console.error('❌ [AUTO-FINALIZE] Failed to finalize round:', error);
                    }
                } finally {
                    isFinalizingRef.current = false;
                }
            }
        };

        // Check immediately and then set up interval for polling
        autoFinalize();
        const interval = setInterval(autoFinalize, 2000); // Check every 2 seconds
        
        return () => clearInterval(interval);
    }, [round, countdownData.remaining, isProcessing, roundNumber, finalizeRound, refresh]);

    // Log round state when fetched
    useEffect(() => {
        if (round) {
            console.log("[ROUND] fetched", round);
            console.log(`[ROUND] status=${RoundStatus[round.status]}, roundNumber=${round.roundNumber.toString()}`);
            console.log(`📦 [ROUND FETCHED] Round ${round.roundNumber.toString()}: status=${RoundStatus[round.status]}, startTs=${round.startTimestamp.toString()}, endTs=${round.endTimestamp.toString()}`);
        } else {
            console.log("[ROUND] No round exists - showing 'Initializing...' (read-only)");
        }
    }, [round]);

    const formatTime = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Buy tickets handler - handles RoundExpired error with automatic retry (once)
    // FIXED: Allow buying even when round doesn't exist (auto-creates on first buy)
    // Updated: Accepts ticketCount parameter for multi-ticket purchases
    const handleBuy = async (ticketCount: number = 1) => {
        // Check if we can buy this many tickets
        const remainingTickets = round ? (1000 - (round.totalTickets?.toNumber() || 0)) : 1000;
        if (ticketCount > remainingTickets) {
            console.warn(`Cannot buy ${ticketCount} tickets, only ${remainingTickets} remaining`);
            return;
        }
        
        if (!canBuy || !publicKey) return;
        
        // Use roundNumber from state, or default to 1 for first buy
        const targetRoundNumber = roundNumber || 1;
        
        setIsProcessing(true);
        const currentRoundNumber = targetRoundNumber;
        
        try {
            // Get current total_tickets from round (for PDA derivation and client-side tracking)
            // If round doesn't exist, total_tickets will be 0 (round auto-creates with total_tickets = 0)
            let currentTotalTickets = 0;
            if (round) {
                currentTotalTickets = round.totalTickets?.toNumber() || 0;
            }
            // If round doesn't exist, total_tickets = 0 (will be used for first TicketPosition)
            
            const [roundPda] = getRoundPda(currentRoundNumber);
            
            await buyTickets(currentRoundNumber, ticketCount);
            
            // Store TicketPosition PDA for this purchase (client-side tracking)
            // SCALABLE MODEL: O(1) - Store PDA immediately after successful purchase
            // Note: For multi-ticket purchases, only ONE TicketPosition PDA is created (with count = ticketCount)
            const [ticketPositionPda] = getTicketPositionPda(roundPda, publicKey, currentTotalTickets);
            
            // Fetch the actual TicketPosition account to get accurate data
            try {
                const ticketPosAccount = await provider?.account.ticketPosition.fetch(ticketPositionPda);
                if (ticketPosAccount) {
                    setOwnedTicketPositions(prev => [...prev, {
                        pda: ticketPositionPda,
                        round: currentRoundNumber,
                        startIndex: ticketPosAccount.startIndex.toNumber(),
                        count: ticketPosAccount.count,
                    }]);
                }
            } catch (err) {
                // Fallback: use expected values if fetch fails
                setOwnedTicketPositions(prev => [...prev, {
                    pda: ticketPositionPda,
                    round: currentRoundNumber,
                    startIndex: currentTotalTickets,
                    count: ticketCount,
                }]);
            }
            
            // Success - refetch round state
            await refresh();
            await findActiveRound();
        } catch (err: any) {
            console.error('Buy tickets failed:', err.message);
            
            // Handle RoundExpired error - retry ONCE with next round number
            const isRoundExpired = err.code === 'RoundExpired' || 
                                   err.message?.includes('RoundExpired') || 
                                   err.message?.includes('Round has expired');
            
            if (isRoundExpired) {
                console.log(`[BUY] Round ${currentRoundNumber} expired, refetching and retrying with next round...`);
                
                try {
                    // Wait a bit for on-chain state to update, then refetch
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await refresh();
                    await findActiveRound();
                    
                    // Try with next round number (on-chain auto-creates it)
                    const nextRoundNumber = currentRoundNumber + 1;
                    console.log(`[BUY] Retrying buy with round ${nextRoundNumber} (single retry)...`);
                    
                    // Fetch next round to get total_tickets for TicketPosition PDA
                    const [nextRoundPda] = getRoundPda(nextRoundNumber);
                    let nextTotalTickets = 0;
                    try {
                        const nextRoundAccount = await provider?.account.round.fetch(nextRoundPda);
                        nextTotalTickets = nextRoundAccount?.totalTickets?.toNumber() || 0;
                    } catch {
                        // Next round doesn't exist yet - will be auto-created
                    }
                    
                    await buyTickets(nextRoundNumber, ticketCount);
                    
                    // Store TicketPosition PDA for retry purchase
                    const [retryTicketPosPda] = getTicketPositionPda(nextRoundPda, publicKey, nextTotalTickets);
                    try {
                        const retryTicketPos = await provider?.account.ticketPosition.fetch(retryTicketPosPda);
                        if (retryTicketPos) {
                            setOwnedTicketPositions(prev => [...prev, {
                                pda: retryTicketPosPda,
                                round: nextRoundNumber,
                                startIndex: retryTicketPos.startIndex.toNumber(),
                                count: retryTicketPos.count,
                            }]);
                        }
                    } catch {
                        // Fallback: use expected values with correct ticketCount
                        setOwnedTicketPositions(prev => [...prev, {
                            pda: retryTicketPosPda,
                            round: nextRoundNumber,
                            startIndex: nextTotalTickets,
                            count: ticketCount,
                        }]);
                    }
                    
                    // Success after retry - refetch again
                    await refresh();
                    await findActiveRound();
                } catch (retryErr: any) {
                    console.error('Buy tickets retry failed:', retryErr.message);
                    throw retryErr; // Re-throw to show error to user
                }
            } else {
                throw err; // Re-throw non-RoundExpired errors
            }
        } finally {
            setIsProcessing(false);
        }
    };

    // Prepare data for UI - SCALABLE MODEL (no ticket iteration)
    // Display round number - show "Initializing..." if no round exists (read-only)
    const roundIdString = roundNumber ? roundNumber.toString() : (connected ? 'Initializing...' : '—');
    const totalTickets = round?.totalTickets?.toNumber() || 0;
    // Countdown: visual only - auto-finalize will handle transition from Active to Ended
    // If round is Active with 0 tickets and countdown reached 0, show "Extended"
    const isRoundExtended = round && round.status === RoundStatus.Active && totalTickets === 0 && timeLeft === 0;
    const timeString = round 
        ? (timeLeft > 0 ? formatTime(timeLeft) : 
           isRoundExtended ? 'Extended' :
           round.status === RoundStatus.Active ? 'Finalizing...' : 'Ended')
        : (connected ? 'Initializing...' : '—');
    const balanceString = vaultBalance.toFixed(2);
    
    // Check if user can claim (has winning TicketPosition)
    // SCALABLE MODEL: Use client-side tracked positions only
    // Show Claim button ONLY when: round.status === Ended, winningIndex !== null, user has TicketPositions
    const canClaim = useMemo(() => {
        if (!connected || !round) {
            return false;
        }
        // Require round is Ended
        if (round.status !== RoundStatus.Ended) {
            return false;
        }
        // Require winningIndex is set (not null/undefined)
        if (!round.winningIndex || round.winningIndex === null) {
            return false;
        }
        // User must have at least one TicketPosition for this round stored locally
        const roundPositions = ownedTicketPositions.filter(p => p.round === roundNumber);
        return roundPositions.length > 0;
    }, [connected, round, roundNumber, ownedTicketPositions]);

    return (
        <div className="min-h-screen bg-brand-dark text-brand-light flex flex-col p-4 md:p-8 select-none">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-brand-light pb-6 mb-8 gap-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tighter">SOL LOTTERY</h1>
                    <p className="text-xs opacity-50">ROUND #{roundIdString}</p>
                </div>

                <div className="flex flex-wrap items-center gap-8 text-sm">
                    <div className="flex flex-col">
                        <span className="opacity-40 uppercase text-[10px] tracking-widest">Time Remaining</span>
                        <span className="text-xl font-mono tabular-nums">
                            {isProcessing && countdownData.remaining === 0 && round?.status === RoundStatus.Active 
                                ? 'Finalizing...' 
                                : timeString}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="opacity-40 uppercase text-[10px] tracking-widest">Prize Pool</span>
                        <span className="text-xl font-bold">{balanceString} SOL</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="opacity-40 uppercase text-[10px] tracking-widest">Sold</span>
                        <span className="text-xl">{String(totalTickets)}</span>
                    </div>
                    {!connected && (
                        <div className="flex items-center">
                            <WalletMultiButton />
                        </div>
                    )}
                    {connected && publicKey && (
                        <div className="flex items-center">
                            <div className="px-4 py-2 border border-brand-light/20 bg-brand-dark text-brand-light text-sm font-mono">
                                {publicKey.toString().slice(0, 4)}...{publicKey.toString().slice(-4)}
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {error && (
                <div className="mb-4 p-4 bg-red-900/20 border border-red-500 text-red-300 text-sm">
                    Error: {error}
                </div>
            )}

            {/* Main Content - SCALABLE MODEL with 1000-block visual progress */}
            <main className="flex-1 flex flex-col items-center justify-center overflow-hidden mb-8">
                {/* 1000-Block Visual Progress UI (PURE UI, no logic) */}
                <div className="w-full max-w-4xl mb-8">
                    <div className="grid gap-[2px] border border-brand-light/10 p-2"
                         style={{ 
                             gridTemplateColumns: 'repeat(50, 1fr)',
                             gridTemplateRows: 'repeat(20, 1fr)'
                         }}>
                        {(() => {
                            // Create shuffled indices for random sold ticket display (UI only)
                            const indices = Array.from({ length: 1000 }, (_, i) => i);
                            for (let i = indices.length - 1; i > 0; i--) {
                                const j = Math.floor(Math.random() * (i + 1));
                                [indices[i], indices[j]] = [indices[j], indices[i]];
                            }
                            const soldIndices = new Set(indices.slice(0, totalTickets));
                            
                            return Array.from({ length: 1000 }, (_, i) => {
                                const isFilled = soldIndices.has(i);
                                return (
                                    <div
                                        key={i}
                                        className={`
                                            aspect-square
                                            ${isFilled ? 'bg-brand-light' : 'bg-transparent border border-brand-light/20'}
                                        `}
                                        style={{ minWidth: '8px', minHeight: '8px' }}
                                    />
                                );
                            });
                        })()}
                    </div>
                    <div className="mt-4 flex gap-4 text-[10px] opacity-40 uppercase tracking-widest justify-center">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 border border-brand-light/20"></div> Available
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-brand-light opacity-50"></div> Sold ({totalTickets}/1000)
                        </div>
                    </div>
                </div>
                
                {/* Round Stats Display */}
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center space-y-4">
                        <div className="text-4xl font-bold">
                            {totalTickets.toLocaleString()} / 1000
                        </div>
                        <div className="text-sm opacity-50 uppercase tracking-widest">
                            Tickets Sold
                        </div>
                        {/* Show extension message when round was extended (0 tickets, still Active after countdown) */}
                        {isRoundExtended && (
                            <div className="text-xs opacity-60 italic mt-2">
                                No tickets sold — round extended
                            </div>
                        )}
                    </div>
                    
                    {/* Multi-ticket purchase buttons - ALWAYS RENDER when wallet connected */}
                    {connected && (
                        <div className="flex flex-col items-center gap-4 w-full">
                            {/* Remaining tickets display - ONLY when round is Active */}
                            {round && round.status === RoundStatus.Active ? (
                                <div className="text-center mb-2">
                                    <div className="text-sm opacity-60">
                                        Remaining: <span className="font-bold">{remainingTickets}</span>
                                    </div>
                                </div>
                            ) : round && round.status === RoundStatus.Ended ? (
                                <div className="text-center mb-2">
                                    <div className="text-sm opacity-60">
                                        Round ended
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center mb-2">
                                    <div className="text-sm opacity-60">
                                        Waiting for next round
                                    </div>
                                </div>
                            )}
                            
                            {/* Buy button group - 1, 3, 5, 10 tickets */}
                            <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                                {[1, 3, 5, 10].map((count) => {
                                    const canBuyThisCount = canBuyCount(count);
                                    const isDisabled = !canBuyThisCount || isProcessing;
                                    
                                    return (
                                        <button
                                            key={count}
                                            onClick={() => handleBuy(count)}
                                            disabled={isDisabled}
                                            className={`
                                                px-6 py-4 
                                                bg-brand-light text-brand-dark 
                                                font-bold uppercase tracking-widest text-sm 
                                                hover:opacity-90 transition-all active:scale-95 
                                                disabled:opacity-30 disabled:cursor-not-allowed
                                                ${isProcessing ? 'opacity-50' : ''}
                                            `}
                                            title={
                                                !canBuyThisCount 
                                                    ? `Only ${remainingTickets} tickets remaining` 
                                                    : `Buy ${count} ticket${count > 1 ? 's' : ''}`
                                            }
                                        >
                                            {isProcessing ? '...' : `Buy ${count}`}
                                        </button>
                                    );
                                })}
                            </div>
                            
                            {/* Helper text */}
                            {!round && (
                                <p className="text-xs opacity-50 text-center">
                                    First purchase will auto-create Round 1
                                </p>
                            )}
                            {round && round.status !== RoundStatus.Active && (
                                <p className="text-xs opacity-50 text-center">
                                    Round not active
                                </p>
                            )}
                        </div>
                    )}
                    
                    {/* Claim button - Show when round ended and user has TicketPositions */}
                    {connected && round?.status === RoundStatus.Ended && round.winningIndex !== null && (
                        <div className="flex flex-col items-center gap-4 border-t border-brand-light/20 pt-8">
                            <div className="text-sm opacity-50 uppercase tracking-widest mb-2">
                                Claim Prize (Select Ticket Position)
                            </div>
                            {ownedTicketPositions.filter(p => p.round === roundNumber).length > 0 ? (
                                <>
                                    <select
                                        value={selectedTicketPosition?.toBase58() || ''}
                                        onChange={(e) => {
                                            try {
                                                setSelectedTicketPosition(e.target.value ? new PublicKey(e.target.value) : null);
                                            } catch (err) {
                                                console.error('Invalid ticket position selected:', err);
                                                setSelectedTicketPosition(null);
                                            }
                                        }}
                                        className="w-full px-4 py-2 bg-brand-dark border border-brand-light/20 text-brand-light text-sm"
                                    >
                                        <option value="">Select a position...</option>
                                        {ownedTicketPositions
                                            .filter(p => p.round === roundNumber)
                                            .map((pos, idx) => {
                                                const winningIndex = round.winningIndex?.toNumber() || 0;
                                                const isWinner = winningIndex >= pos.startIndex && winningIndex < pos.startIndex + pos.count;
                                                return (
                                                    <option key={idx} value={pos.pda.toBase58()}>
                                                        Position [{pos.startIndex}-{pos.startIndex + pos.count - 1}]
                                                        {isWinner ? ' ✓ WINNER' : ''}
                                                    </option>
                                                );
                                            })}
                                    </select>
                                    <button
                                        onClick={async () => {
                                            if (!selectedTicketPosition || !roundNumber) return;
                                            setIsProcessing(true);
                                            try {
                                                await claimPrize(roundNumber, selectedTicketPosition);
                                                
                                                // Remove claimed TicketPosition from local state
                                                setOwnedTicketPositions(prev => 
                                                    prev.filter(p => !p.pda.equals(selectedTicketPosition))
                                                );
                                                setSelectedTicketPosition(null);
                                                
                                                // Refetch round state (next round should be active)
                                                await refresh();
                                                await findActiveRound();
                                            } catch (err: any) {
                                                console.error('Claim failed:', err.message);
                                                alert(err.message || 'Failed to claim prize');
                                            } finally {
                                                setIsProcessing(false);
                                            }
                                        }}
                                        disabled={!selectedTicketPosition || isProcessing}
                                        className="w-full px-8 py-4 bg-green-600 text-white font-bold uppercase tracking-widest text-sm hover:opacity-90 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        {isProcessing ? 'Claiming...' : 'Claim Prize'}
                                    </button>
                                </>
                            ) : (
                                <p className="text-xs opacity-50 text-center">
                                    No ticket positions found for this round. Purchase tickets to participate.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {loading && !round && (
                <div className="mb-8 text-center">
                    <p className="text-sm opacity-50">Loading lottery data...</p>
                </div>
            )}

            {/* Footer - Round status display only (read-only) */}
            {(!loading && round) && (
                <footer className="border-t border-brand-light pt-8 flex flex-col md:flex-row justify-end items-end gap-6">
                    <div className="flex flex-col items-end gap-2">
                        {round.status === RoundStatus.Active && (
                            <p className="text-xs opacity-30 uppercase">
                                Round active - lifecycle managed on-chain
                            </p>
                        )}
                        {round.status === RoundStatus.Ended && (
                            <p className="text-xs opacity-30 uppercase">
                                {round.winningIndex !== null
                                    ? `Winning index: ${round.winningIndex.toString()} (out of ${round.totalTickets.toString()} tickets)`
                                    : 'Round ended with no tickets'}
                            </p>
                        )}
                        {round.status === RoundStatus.Claimed && (
                            <p className="text-xs opacity-30 uppercase">
                                Prize claimed - next round will start automatically
                            </p>
                        )}
                    </div>
                </footer>
            )}
            
            {!loading && !round && (
                <footer className="border-t border-brand-light pt-8 flex flex-col items-center gap-4">
                    <p className="text-sm opacity-50">
                        {connected ? 'Waiting for round initialization (on-chain)' : 'Connect wallet to start'}
                    </p>
                </footer>
            )}
        </div>
    );
};

export default LotteryPage;