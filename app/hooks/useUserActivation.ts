import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { ADMIN_WALLET } from '../constants';
import { getUserProfilePda } from '../utils/pdas';
import { UserProfile } from '../types';

/**
 * Custom hook for user activation - SANITY TEST: Always returns activated=true
 */
export function useUserActivation(program: Program<any> | null) {
    // SANITY TEST: Always return activated=true, no program calls
    return {
        activated: true,
        loading: false,
        error: null,
        activate: async () => { throw new Error('Activation disabled for sanity test'); },
        refresh: async () => {},
    };
}

