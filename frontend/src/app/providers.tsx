"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useConnect, useConnection } from "wagmi";
import { injected } from "wagmi";
import { ThirdwebProvider, useActiveAccount } from "thirdweb/react";
import { useEffect, useRef } from "react";
import { wagmiConfig } from "@/lib/wagmi";

const queryClient = new QueryClient();

// Bridges thirdweb wallet connection into wagmi so hooks like useWalletClient work
function WagmiBridge() {
  const thirdwebAccount = useActiveAccount();
  const { address: wagmiAddress } = useConnection();
  const { connect } = useConnect();
  const connectingRef = useRef(false);

  useEffect(() => {
    if (thirdwebAccount && !wagmiAddress && !connectingRef.current) {
      connectingRef.current = true;
      connect(
        { connector: injected() },
        { onSettled: () => { connectingRef.current = false; } }
      );
    }
  }, [thirdwebAccount, wagmiAddress, connect]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThirdwebProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <WagmiBridge />
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </ThirdwebProvider>
  );
}