import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

// Program ID
const PROGRAM_ID = new PublicKey("57BGqiA2YWkF9u58EYnSRfJHJCPHPEiftnojD5fqys8r");

// Read IDL
const idlPath = path.join(__dirname, "../target/idl/sollottery.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

async function main() {
    // Connect to devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Load wallet from keypair file
    const walletPath = process.env.ANCHOR_WALLET || path.join(process.env.HOME!, ".config/solana/id.json");
    const walletKeypair = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
    );
    
    const wallet = new anchor.Wallet(walletKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    
    // Create program instance
    const program = new Program(idl, PROGRAM_ID, provider);
    
    console.log("Wallet address:", wallet.publicKey.toString());
    console.log("Program ID:", PROGRAM_ID.toString());
    
    // Initialize round 1
    const roundNumber = new anchor.BN(1);
    
    // Derive PDAs
    const [roundPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("round"), roundNumber.toArrayLike(Buffer, "le", 8)],
        program.programId
    );
    
    const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), roundNumber.toArrayLike(Buffer, "le", 8)],
        program.programId
    );
    
    console.log("Round PDA:", roundPda.toString());
    console.log("Vault PDA:", vaultPda.toString());
    
    try {
        // Check if round already exists
        const roundAccount = await program.account.round.fetch(roundPda);
        console.log("Round already exists:", roundAccount);
        console.log("Round number:", roundAccount.roundNumber.toString());
        console.log("Round status:", roundAccount.status);
        return;
    } catch (e: any) {
        if (e.message && e.message.includes("Account does not exist")) {
            console.log("Round does not exist, initializing...");
        } else {
            throw e;
        }
    }
    
    // Initialize the round
    console.log("Initializing round 1...");
    const tx = await program.methods
        .initialize(roundNumber)
        .accounts({
            round: roundPda,
            roundVault: vaultPda,
            authority: wallet.publicKey,
            systemProgram: SystemProgram.programId,
        })
        .rpc();
    
    console.log("Transaction signature:", tx);
    console.log("Round 1 initialized successfully!");
    
    // Fetch and display the round
    const roundAccount = await program.account.round.fetch(roundPda);
    console.log("\nRound details:");
    console.log("Round number:", roundAccount.roundNumber.toString());
    console.log("Start timestamp:", roundAccount.startTimestamp.toString());
    console.log("End timestamp:", roundAccount.endTimestamp.toString());
    console.log("Status:", roundAccount.status);
    
    const now = Math.floor(Date.now() / 1000);
    const endTime = roundAccount.endTimestamp.toNumber();
    const duration = endTime - now;
    console.log("Duration (seconds):", duration);
    console.log("Duration (minutes):", Math.floor(duration / 60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

