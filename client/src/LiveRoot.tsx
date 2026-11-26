import "./polyfills";
import "@solana/wallet-adapter-react-ui/styles.css";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { useMemo } from "react";
import App from "./App";
import { BASE_RPC } from "./chain/config";
import { GuestWalletAdapter } from "./chain/guestWallet";

export default function LiveRoot({ onExit }: { onExit: () => void }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new GuestWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={BASE_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <App onExit={onExit} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

