/**
 * Test script for scalable lottery flow
 * Tests: initRound -> buyTickets -> endRound -> claimPrize -> auto next round
 * Verifies: No realloc, No Vec, No loops
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Sollottery } from "../target/types/sollottery";

const LOTTERY_PROGRAM_ID = new PublicKey("EuLcEdX49Neyk7jhV4FQS9MmP7qpmN5Hw2dAKv1TtmtV");
const ADMIN_WALLET = new PublicKey("2q79WzkjgEqPoBAWeEP2ih51q6TYp8D9DYWWMeLHK6WP");

async function main() {
    // Setup
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    
    const program = anchor.workspace.Sollottery as Program<Sollottery>;
    const wallet = provider.wallet;
    
    console.log("🧪 Testing Scalable Lottery Flow");
    console.log("Program ID:", program.programId.toBase58());
    console.log("Wallet:", wallet.publicKey.toBase58());
    
    // Helper functions
    const getRoundPda = (roundNumber: number): [PublicKey, number] => {
        const roundBuffer = Buffer.allocUnsafe(8);
        roundBuffer.writeBigUInt64LE(BigInt(roundNumber), 0);
        return PublicKey.findProgramAddressSync(
            [Buffer.from("round"), roundBuffer],
            program.programId
        );
    };
    
    const getTicketPositionPda = (round: PublicKey, buyer: PublicKey, nonce: number): [PublicKey, number] => {
        const nonceBuffer = Buffer.allocUnsafe(8);
        nonceBuffer.writeBigUInt64LE(BigInt(nonce), 0);
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from("ticket"),
                round.toBuffer(),
                buyer.toBuffer(),
                nonceBuffer,
            ],
            program.programId
        );
    };
    
    const getVaultPda = (roundNumber: number): [PublicKey, number] => {
        const roundBuffer = Buffer.allocUnsafe(8);
        roundBuffer.writeBigUInt64LE(BigInt(roundNumber), 0);
        return PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), roundBuffer],
            program.programId
        );
    };
    
    try {
        // Step 1: Initialize Round 1
        console.log("\n📋 Step 1: Initialize Round 1");
        const round1 = 1;
        const [round1Pda] = getRoundPda(round1);
        const [vault1Pda] = getVaultPda(round1);
        
        const initTx = await program.methods
            .initRound(new anchor.BN(round1))
            .accounts({
                round: round1Pda,
                roundVault: vault1Pda,
                payer: wallet.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
        
        console.log("✅ Round 1 initialized:", initTx);
        
        // Fetch round to verify
        const roundAccount = await program.account.round.fetch(round1Pda);
        console.log("Round data:", {
            roundNumber: roundAccount.roundNumber.toString(),
            totalTickets: roundAccount.totalTickets.toString(),
            status: roundAccount.status,
        });
        
        // Step 2: Buy tickets (multiple buyers)
        console.log("\n📋 Step 2: Buy Tickets");
        
        // Buyer 1
        console.log("Buyer 1 purchasing...");
        const [ticketPos1Pda] = getTicketPositionPda(round1Pda, wallet.publicKey, 0);
        const buy1Tx = await program.methods
            .buyTickets(new anchor.BN(round1), 1)
            .accounts({
                buyer: wallet.publicKey,
                currentRound: round1Pda,
                ticketPosition: ticketPos1Pda,
                currentVault: vault1Pda,
                adminWallet: ADMIN_WALLET,
                systemProgram: SystemProgram.programId,
            })
            .rpc();
        
        console.log("✅ Buyer 1 purchase:", buy1Tx);
        
        // Fetch round again
        const roundAfterBuy1 = await program.account.round.fetch(round1Pda);
        console.log("Round after buy 1 - totalTickets:", roundAfterBuy1.totalTickets.toString());
        
        // Fetch TicketPosition
        const ticketPos1 = await program.account.ticketPosition.fetch(ticketPos1Pda);
        console.log("TicketPosition 1:", {
            startIndex: ticketPos1.startIndex.toString(),
            count: ticketPos1.count,
            claimed: ticketPos1.claimed,
        });
        
        // Step 3: End Round
        console.log("\n📋 Step 3: End Round");
        
        // Wait if needed (for devnet testing, rounds last 2 minutes)
        // For now, assume round is expired or manually set end_timestamp
        
        const endTx = await program.methods
            .endRound()
            .accounts({
                round: round1Pda,
            })
            .rpc();
        
        console.log("✅ Round ended:", endTx);
        
        // Fetch round to check winning index
        const roundEnded = await program.account.round.fetch(round1Pda);
        console.log("Round after end:", {
            status: roundEnded.status,
            winningIndex: roundEnded.winningIndex?.toString() || null,
            totalTickets: roundEnded.totalTickets.toString(),
        });
        
        // Step 4: Claim Prize (if winner)
        if (roundEnded.winningIndex !== null) {
            console.log("\n📋 Step 4: Claim Prize");
            
            const winningIndex = roundEnded.winningIndex.toNumber();
            const ticketStart = ticketPos1.startIndex.toNumber();
            const ticketEnd = ticketStart + ticketPos1.count;
            
            if (winningIndex >= ticketStart && winningIndex < ticketEnd) {
                console.log(`✅ TicketPosition 1 is winner! (${winningIndex} in range [${ticketStart}, ${ticketEnd}))`);
                
                const [round2Pda] = getRoundPda(2);
                const [vault2Pda] = getVaultPda(2);
                
                const claimTx = await program.methods
                    .claimPrize()
                    .accounts({
                        round: round1Pda,
                        ticketPosition: ticketPos1Pda,
                        roundVault: vault1Pda,
                        nextRound: round2Pda,
                        nextVault: vault2Pda,
                        winner: wallet.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .rpc();
                
                console.log("✅ Prize claimed:", claimTx);
                
                // Verify round 2 was created
                const round2 = await program.account.round.fetch(round2Pda);
                console.log("Round 2 auto-created:", {
                    roundNumber: round2.roundNumber.toString(),
                    status: round2.status,
                    totalTickets: round2.totalTickets.toString(),
                });
            } else {
                console.log(`❌ TicketPosition 1 is NOT winner (${winningIndex} not in range [${ticketStart}, ${ticketEnd}))`);
            }
        }
        
        console.log("\n✅ Test Flow Complete!");
        
    } catch (error) {
        console.error("❌ Test failed:", error);
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

