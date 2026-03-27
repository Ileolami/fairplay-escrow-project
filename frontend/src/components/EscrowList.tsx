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

  const { data: escrowCount, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: FAIRPAY_ABI,
    functionName: "escrowCount",
  });

  const count = escrowCount ? Number(escrowCount) : 0;

  const ids = Array.from({ length: count }, (_, i) => BigInt(i));

  if (count === 0) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500">
        No escrows found. Create one above!
      </div>
    );
  }

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
  const { data: escrow } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: FAIRPAY_ABI,
    functionName: "getEscrow",
    args: [escrowId],
  }) as {
    data:
      | { client: `0x${string}`; freelancer: `0x${string}` }
      | undefined;
  };

  if (!escrow) return null;

  if (filter === "mine" && address) {
    const isInvolved =
      escrow.client.toLowerCase() === address.toLowerCase() ||
      escrow.freelancer.toLowerCase() === address.toLowerCase();
    if (!isInvolved) return null;
  }

  return <EscrowCard escrowId={escrowId} onRefresh={onRefresh} />;
}