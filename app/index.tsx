import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { Buffer } from 'buffer';
import App from './App.tsx';

// Polyfill Buffer for browser
window.Buffer = Buffer;
(globalThis as any).Buffer = Buffer;

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

// Set network (default to devnet, change to 'mainnet-beta' for production)
const network = WalletAdapterNetwork.Devnet;
const endpoint = clusterApiUrl(network);

// Configure wallets
const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
];

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
      <App />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </React.StrictMode>
  );
}