"use client";

import { useReadContract, useConnection } from "wagmi";
import { FAIRPAY_ABI, CONTRACT_ADDRESS } from "@/lib/abi";
import EscrowCard from "./EscrowCard";

type FilterMode = "all" | "mine";

export default function EscrowList({
  filter = "all",
}: {
  filter?: FilterMode;
  refreshKey?: number;
}) {
  const { address } = useConnection();

  const { data: escrowCount, isLoading: countLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: FAIRPAY_ABI,
    functionName: "escrowCount",
  });

  if (countLoading || escrowCount === undefined) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        ))}
      </div>
    );
  }

  const count = Number(escrowCount);

  if (count === 0) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500">
        No escrows found. Create one above!
      </div>
    );
  }

  const ids = Array.from({ length: count }, (_, i) => BigInt(i));

  return (
    <div className="space-y-3">
      {ids
        .slice()
        .reverse()
        .map((id) => (
          <EscrowCardWrapper
            key={id.toString()}
            escrowId={id}
            filter={filter}
            address={address}
            onRefresh={refetch}
          />
        ))}
    </div>
  );
}

// Wrapper that filters by role after fetching data
function EscrowCardWrapper({
  escrowId,
  filter,
  address,
  onRefresh,
}: {
  escrowId: bigint;
  filter: FilterMode;
  address?: string;
  onRefresh?: () => void;
}) {
  const { data: escrow, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: FAIRPAY_ABI,
    functionName: "getEscrow",
    args: [escrowId],
  }) as {
    data: { client: `0x${string}`; freelancer: `0x${string}` } | undefined;
    isLoading: boolean;
  };

  if (isLoading || !escrow) {
    return (
      <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    );
  }

  if (filter === "mine" && address) {
    const isInvolved =
      escrow.client.toLowerCase() === address.toLowerCase() ||
      escrow.freelancer.toLowerCase() === address.toLowerCase();
    if (!isInvolved) return null;
  }

  return <EscrowCard escrowId={escrowId} onRefresh={onRefresh} />;
}
