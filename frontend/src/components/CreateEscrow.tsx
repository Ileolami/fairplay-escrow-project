"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useConnection } from "wagmi";
import { isAddress } from "viem";
import { FAIRPAY_ABI, CONTRACT_ADDRESS } from "@/lib/abi";

export default function CreateEscrow({ onCreated }: { onCreated?: () => void }) {
  const { address } = useConnection();
  const [freelancer, setFreelancer] = useState("");
  const [reviewDays, setReviewDays] = useState("3");
  const [disputeDays, setDisputeDays] = useState("5");
  const [workDays, setWorkDays] = useState("14");
  const [error, setError] = useState("");

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!address) {
      setError("Connect your wallet first.");
      return;
    }
    if (!isAddress(freelancer)) {
      setError("Invalid freelancer address.");
      return;
    }
    if (freelancer.toLowerCase() === address.toLowerCase()) {
      setError("Client and freelancer cannot be the same address.");
      return;
    }

    const reviewSecs = BigInt(Math.floor(Number(reviewDays) * 86400));
    const disputeSecs = BigInt(Math.floor(Number(disputeDays) * 86400));
    const workSecs = BigInt(Math.floor(Number(workDays) * 86400));

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: FAIRPAY_ABI,
      functionName: "createEscrow",
      args: [freelancer as `0x${string}`, reviewSecs, disputeSecs, workSecs],
    });
  }

  if (isSuccess) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-950/30">
        <p className="text-green-700 dark:text-green-400 font-medium">
          Escrow created successfully!
        </p>
        <button
          onClick={() => {
            setFreelancer("");
            setReviewDays("3");
            setDisputeDays("5");
            setWorkDays("14");
            onCreated?.();
          }}
          className="mt-3 text-sm text-green-600 underline dark:text-green-400"
        >
          Create another
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        New Escrow
      </h2>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Freelancer Address
        </label>
        <input
          type="text"
          value={freelancer}
          onChange={(e) => setFreelancer(e.target.value)}
          placeholder="0x..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-mono text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Work deadline (days)
          </label>
          <input
            type="number"
            min="1"
            placeholder="14"
            value={workDays}
            onChange={(e) => setWorkDays(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Review period (days)
          </label>
          <input
            type="number"
            min="1"
            placeholder="3"
            value={reviewDays}
            onChange={(e) => setReviewDays(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Dispute period (days)
          </label>
          <input
            type="number"
            min="1"
            placeholder="5"
            value={disputeDays}
            onChange={(e) => setDisputeDays(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending || isConfirming || !address}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {isPending
          ? "Confirm in wallet..."
          : isConfirming
          ? "Creating escrow..."
          : "Create Escrow"}
      </button>

      {!address && (
        <p className="text-center text-xs text-zinc-500">
          Connect your wallet to create an escrow
        </p>
      )}
    </form>
  );
}