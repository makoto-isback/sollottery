import * as anchor from "@coral-xyz/anchor";
import { Program, Idl } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Program ID
const PROGRAM_ID = new PublicKey("57BGqiA2YWkF9u58EYnSRfJHJCPHPEiftnojD5fqys8r");

// Convert snake_case to camelCase
function toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

// Convert new IDL format to old format for Anchor 0.29.0
function convertIdlToOldFormat(idl: any): any {
    const converted = JSON.parse(JSON.stringify(idl));
    
    // Convert instructions
    if (converted.instructions && Array.isArray(converted.instructions)) {
        converted.instructions = converted.instructions.map((ix: any) => {
            const newIx: any = {
                name: toCamelCase(ix.name),
                docs: ix.docs || [],
                accounts: [],
                args: ix.args || [],
            };
            
            if (ix.accounts && Array.isArray(ix.accounts)) {
                newIx.accounts = ix.accounts.map((acc: any) => {
                    const newAcc: any = {
                        name: toCamelCase(acc.name),
                        isMut: acc.writable !== false,
                        isSigner: acc.signer === true,
                    };
                    // Preserve PDA information if it exists
                    if (acc.pda) {
                        newAcc.pda = acc.pda;
                    }
                    return newAcc;
                });
            }
            
            return newIx;
        });
    }
    
    // Convert types: pubkey -> publicKey
    if (converted.types && Array.isArray(converted.types)) {
        converted.types = converted.types.map((typeDef: any) => {
            const newTypeDef = JSON.parse(JSON.stringify(typeDef));
            
            function convertPubkey(obj: any): any {
                if (typeof obj === 'string') {
                    return obj === 'pubkey' ? 'publicKey' : obj;
                }
                if (Array.isArray(obj)) {
                    return obj.map(convertPubkey);
                }
                if (obj && typeof obj === 'object') {
                    if (obj.defined) {
                        if (obj.defined.name) {
                            return { defined: obj.defined.name };
                        }
                        return obj;
                    }
                    const converted: any = {};
                    for (const key in obj) {
                        converted[key] = convertPubkey(obj[key]);
                    }
                    return converted;
                }
                return obj;
            }
            
            newTypeDef.type = convertPubkey(newTypeDef.type);
            return newTypeDef;
        });
    }
    
    // Convert accounts array
    if (converted.accounts && Array.isArray(converted.accounts) && converted.types) {
        converted.accounts = converted.accounts.map((acc: any) => {
            const typeDef = converted.types.find((t: any) => t.name === acc.name);
            if (typeDef && typeDef.type) {
                return { name: acc.name, type: typeDef.type };
            }
            return { name: acc.name };
        });
    }
    
    // Add version and name
    if (!converted.version) {
        converted.version = converted.metadata?.version || "0.1.0";
    }
    if (!converted.name) {
        converted.name = converted.metadata?.name || "sollottery";
    }
    
    delete converted.metadata;
    delete converted.address;
    
    return converted;
}

// Read and convert IDL (required for Anchor 0.29.0)
const idlPath = path.join(__dirname, "../idl.json");
const idlJson = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
const idl = convertIdlToOldFormat(idlJson) as Idl;

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
    const program = new Program(idl as anchor.Idl, PROGRAM_ID, provider);
    
    console.log("Wallet address:", wallet.publicKey.toString());
    console.log("Program ID:", PROGRAM_ID.toString());
    
    // Initialize round 1
    const roundNumber = new BN(1);
    
    // Derive PDAs manually - use BN.toArrayLike to match Anchor's internal method
    const roundNumberBuffer = roundNumber.toArrayLike(Buffer, "le", 8);
    const [roundPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("round"), roundNumberBuffer],
        PROGRAM_ID
    );
    
    const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), roundNumberBuffer],
        PROGRAM_ID
    );
    
    console.log("Round PDA:", roundPda.toString());
    console.log("Vault PDA:", vaultPda.toString());
    
    try {
        // Check if round already exists
        const roundAccount = await (program.account as any).round.fetch(roundPda);
        console.log("Round already exists:");
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
    // Use the exact account structure from the IDL (after conversion, accounts are camelCase)
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
    const roundAccount = await (program.account as any).round.fetch(roundPda);
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

