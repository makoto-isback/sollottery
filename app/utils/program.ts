import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { LOTTERY_PROGRAM_ID } from '../constants';
import type { Idl } from '@coral-xyz/anchor';

// Import IDL JSON
import IDL_JSON from '../idl.json';

/**
 * Convert snake_case to camelCase
 */
function toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Convert new IDL format (with discriminator, writable, signer) to old format (isMut, isSigner)
 * This is needed for Anchor 0.29.0 JS client compatibility
 */
function convertIdlToOldFormat(idl: any): any {
    const converted = JSON.parse(JSON.stringify(idl));
    
    // Convert instructions (metadata/address will be removed later after extracting values)
    if (converted.instructions && Array.isArray(converted.instructions)) {
        converted.instructions = converted.instructions.map((ix: any) => {
            const newIx: any = {
                name: toCamelCase(ix.name), // Convert snake_case to camelCase
                docs: ix.docs || [],
                accounts: [],
                args: (ix.args || []).map((arg: any) => ({
                    ...arg,
                    name: toCamelCase(arg.name), // Convert argument names to camelCase
                })),
            };
            
            // Convert accounts - also convert account names to camelCase
            if (ix.accounts && Array.isArray(ix.accounts)) {
                newIx.accounts = ix.accounts.map((acc: any) => {
                    const newAcc: any = {
                        name: toCamelCase(acc.name), // Convert snake_case to camelCase
                        // Handle both old format (isMut) and new format (writable)
                        isMut: acc.isMut !== undefined ? acc.isMut : (acc.writable !== false),
                        isSigner: acc.isSigner !== undefined ? acc.isSigner : (acc.signer === true),
                    };
                    return newAcc;
                });
            }
            
            return newIx;
        });
    }
    
    // Helper: Recursively convert pubkey to publicKey and handle defined types
    function convertPubkey(obj: any): any {
        if (typeof obj === 'string') {
            if (obj === 'pubkey') {
                return 'publicKey';
            }
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(convertPubkey);
        }
        if (obj && typeof obj === 'object') {
            // Handle defined types - old format uses just the string name
            if (obj.defined) {
                // If it's { defined: { name: "RoundStatus" } }, convert to { defined: "RoundStatus" }
                if (obj.defined.name) {
                    return { defined: obj.defined.name };
                }
                // If it's already { defined: "RoundStatus" }, keep it
                return obj;
            }
            const result: any = {};
            for (const key in obj) {
                result[key] = convertPubkey(obj[key]);
            }
            return result;
        }
        return obj;
    }
    
    // Convert types: pubkey -> publicKey (old format uses publicKey)
    if (converted.types && Array.isArray(converted.types)) {
        converted.types = converted.types.map((typeDef: any) => {
            const newTypeDef = JSON.parse(JSON.stringify(typeDef));
            newTypeDef.type = convertPubkey(newTypeDef.type);
            return newTypeDef;
        });
    }
    
    // Ensure accounts have type definitions
    // Anchor 0.29.0 needs accounts to have type definitions
    if (converted.accounts && Array.isArray(converted.accounts)) {
        converted.accounts = converted.accounts.map((acc: any) => {
            // If account already has type, preserve it (apply pubkey conversion)
            if (acc.type) {
                return {
                    name: acc.name,
                    type: convertPubkey(acc.type),
                };
            }
            
            // Otherwise look for matching type in types array
            if (converted.types) {
                const typeDef = converted.types.find((t: any) => t.name === acc.name);
                if (typeDef && typeDef.type) {
                    return {
                        name: acc.name,
                        type: typeDef.type,
                    };
                }
            }
            
            // Fallback - shouldn't happen
            return { name: acc.name };
        });
    }
    
    // Keep errors as-is
    
    // Add version and name at top level (old format requires these)
    if (!converted.version) {
        converted.version = converted.metadata?.version || "0.1.0";
    }
    if (!converted.name) {
        converted.name = converted.metadata?.name || "sollottery";
    }
    
    // Now remove metadata (after extracting version/name)
    delete converted.metadata;
    // Remove address - old format doesn't have it, program ID is passed separately to Program constructor
    delete converted.address;
    
    return converted;
}

// Convert IDL to old format for Anchor 0.29.0 JS client
let IDL: Idl;
try {
    IDL = convertIdlToOldFormat(IDL_JSON) as Idl;
    console.log('✅ IDL converted successfully');
    
    // Debug: Check account and type structure
    if (IDL.accounts && IDL.types) {
        const accountNames = IDL.accounts.map((acc: any) => acc.name);
        const typeNames = IDL.types.map((t: any) => t.name);
        console.log('🔍 Account names:', accountNames);
        console.log('🔍 Type names:', typeNames);
        
        // Check first account type structure
        if (IDL.accounts[0]) {
            console.log('🔍 First account structure:', JSON.stringify(IDL.accounts[0], null, 2));
        }
        // Check first type structure
        if (IDL.types[0]) {
            console.log('🔍 First type structure:', JSON.stringify(IDL.types[0], null, 2));
        }
    }
} catch (e: any) {
    console.error('❌ Error converting IDL:', e);
    throw e;
}
import { Round, RoundStatus } from '../types';
import { getRoundPda } from './pdas';

/**
 * Re-export PDA functions for convenience
 */
export { getRoundPda, getVaultPda, getTicketPositionPda } from './pdas';

/**
 * Create an Anchor provider from wallet adapter
 */
export function getProvider(
    connection: Connection,
    wallet: WalletContextState
): AnchorProvider | null {
    if (!wallet || !wallet.publicKey) return null;

    const provider = new AnchorProvider(
        connection,
        wallet as any,
        {
            preflightCommitment: 'processed',
            commitment: 'confirmed',
        }
    );

    return provider;
}

/**
 * Create a Program instance
 */
export function getProgram(
    provider: AnchorProvider | null,
    connection: Connection
): Program<any> | null {
    const programId = LOTTERY_PROGRAM_ID;

    try {
        if (!provider) {
            const fakeWallet = {
                publicKey: PublicKey.default,
                signTransaction: async () => { throw new Error('No wallet'); },
                signAllTransactions: async () => { throw new Error('No wallet'); },
            };
            const readOnlyProvider = new AnchorProvider(connection, fakeWallet as any, {
                preflightCommitment: 'processed',
            });
            
            const readOnlyProgram = new Program(IDL, programId, readOnlyProvider);
            console.log("DEBUG: Program ID (read-only):", readOnlyProgram.programId.toBase58());
            console.log("Available methods:", Object.keys(readOnlyProgram.methods));
            return readOnlyProgram;
        }

        const program = new Program(IDL, programId, provider);
        console.log("DEBUG: Program ID:", program.programId.toBase58());
        console.log("DEBUG: Expected Program ID: EuLcEdX49Neyk7jhV4FQS9MmP7qpmN5Hw2dAKv1TtmtV");
        console.log("DEBUG: Program IDs match:", program.programId.toBase58() === "EuLcEdX49Neyk7jhV4FQS9MmP7qpmN5Hw2dAKv1TtmtV");
        console.log("Available methods:", Object.keys(program.methods));
        return program;
    } catch (e: any) {
        console.error('❌ Error creating program:', e);
        console.error('Error message:', e?.message);
        console.error('Stack:', e?.stack);
        return null;
    }
}

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
 * Find the current active round by checking round numbers sequentially
 * Returns the round number of the active round, or null if none found
 */
export async function findActiveRound(
    program: Program<any>,
    startRound: number = 1,
    maxRounds: number = 100
): Promise<number | null> {
    for (let i = startRound; i < startRound + maxRounds; i++) {
        try {
            const [roundPda] = getRoundPda(i);
            const roundAccount = await program.account.round.fetch(roundPda) as any;
            
            const status = getRoundStatusFromAccount(roundAccount.status);
            
            // SCALABLE MODEL: Round uses totalTickets and winningIndex (not winningNumber/winner)
            const round: Round = {
                roundNumber: roundAccount.roundNumber,
                startTimestamp: roundAccount.startTimestamp,
                endTimestamp: roundAccount.endTimestamp,
                totalTickets: roundAccount.totalTickets,
                winningIndex: roundAccount.winningIndex ? roundAccount.winningIndex : null,
                status,
                bump: roundAccount.bump,
            };

            // Check if this round is active
            if (round.status === RoundStatus.Active) {
                return i;
            }

            // If we hit a claimed round, the next round should be active (if it exists)
            if (round.status === RoundStatus.Claimed) {
                // Check next round
                const nextRoundNum = i + 1;
                try {
                    const [nextRoundPda] = getRoundPda(nextRoundNum);
                    const nextRoundAccount = await program.account.round.fetch(nextRoundPda) as any;
                    const nextStatus = getRoundStatusFromAccount(nextRoundAccount.status);
                    if (nextStatus === RoundStatus.Active) {
                        return nextRoundNum;
                    }
                } catch {
                    // Next round doesn't exist yet, return null
                    return null;
                }
            }
        } catch (e) {
            // Round doesn't exist, continue searching
            continue;
        }
    }

    return null;
}

/**
 * Get the latest round number (highest round number that exists)
 */
export async function getLatestRoundNumber(
    program: Program<any>,
    startRound: number = 1,
    maxRounds: number = 100
): Promise<number | null> {
    let latestRound: number | null = null;

    for (let i = startRound; i < startRound + maxRounds; i++) {
        try {
            const [roundPda] = getRoundPda(i);
            await program.account.round.fetch(roundPda);
            latestRound = i;
        } catch {
            // Round doesn't exist, stop searching
            break;
        }
    }

    return latestRound;
}

