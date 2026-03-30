"use client";

import { ConnectButton } from "thirdweb/react";
import { useConnection } from "wagmi";
import { client } from "@/lib/client";

export default function Header() {
  const { address } = useConnection();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-sm font-bold">
            FP
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              FairPay Escrow
            </h1>
            <p className="text-xs text-zinc-500">RSK Testnet</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {address && (
            <span className="hidden rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400 sm:inline">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          )}
          <ConnectButton client={client} />
        </div>
      </div>
    </header>
  );
}