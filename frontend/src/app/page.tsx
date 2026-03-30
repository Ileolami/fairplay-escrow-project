"use client";

import { useState } from "react";
import Header from "@/components/Header";
import CreateEscrow from "@/components/CreateEscrow";
import EscrowList from "@/components/EscrowList";
import { useConnection } from "wagmi";

type Tab = "my-escrows" | "all-escrows" | "create";

export default function Home() {
  const { address } = useConnection();
  const [tab, setTab] = useState<Tab>("my-escrows");
  const [refreshKey, setRefreshKey] = useState(0);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "my-escrows", label: "My Escrows" },
    { id: "all-escrows", label: "All Escrows" },
    { id: "create", label: "+ Create" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {/* Tab bar */}
        <div className="mb-6 flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "create" && (
          <CreateEscrow
            onCreated={() => {
              refresh();
              setTab("my-escrows");
            }}
          />
        )}

        {tab === "my-escrows" && (
          <>
            {!address ? (
              <div className="py-12 text-center text-sm text-zinc-500">
                Connect your wallet to see your escrows.
              </div>
            ) : (
              <EscrowList filter="mine" refreshKey={refreshKey} />
            )}
          </>
        )}

        {tab === "all-escrows" && (
          <EscrowList filter="all" refreshKey={refreshKey} />
        )}
      </main>

      <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-400 dark:border-zinc-800">
        FairPay Escrow — RSK Testnet
      </footer>
    </div>
  );
}