"use client";

import { useState, useEffect } from "react";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useConnection,
} from "wagmi";
import { formatEther, parseEther } from "viem";
import { FAIRPAY_ABI, CONTRACT_ADDRESS, STATE_LABELS, STATE_COLORS } from "@/lib/abi";

type EscrowData = {
  client: `0x${string}`;
  freelancer: `0x${string}`;
  amount: bigint;
  state: number;
  workLink: string;
  submissionTimestamp: bigint;
  reviewPeriod: bigint;
  disputePeriod: bigint;
  workDuration: bigint;
  workDeadline: bigint;
  disputeDeadline: bigint;
  disputeResponded: boolean;
  disputeReason: string;
  disputeProof: string;
};

function formatAddr(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatDate(ts: bigint) {
  if (ts === BigInt(0)) return "—";
  return new Date(Number(ts) * 1000).toLocaleDateString();
}

function ActionButton({
  label,
  onClick,
  variant = "default",
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger" | "success";
  disabled?: boolean;
}) {
  const base =
    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    danger: "bg-red-600 text-white hover:bg-red-700",
    success: "bg-green-600 text-white hover:bg-green-700",
  };
  return (
    <button className={`${base} ${variants[variant]}`} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

const URL_REGEX = /https?:\/\/[^\s]+/g;

function LinkOrText({ value }: { value: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push(value.slice(lastIndex, match.index));
    }
    parts.push(
      <a key={match.index} href={match[0]} target="_blank" rel="noopener noreferrer"
        className="break-all text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
        {match[0]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < value.length) {
    parts.push(value.slice(lastIndex));
  }

  return <p className="break-all text-zinc-800 dark:text-zinc-200">{parts}</p>;
}

export default function EscrowCard({
  escrowId,
  onRefresh,
}: {
  escrowId: bigint;
  onRefresh?: () => void;
}) {
  const { address } = useConnection();
  const [depositAmount, setDepositAmount] = useState("");
  const [workInput, setWorkInput] = useState("");
  const [proofInput, setProofInput] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [expanded, setExpanded] = useState(false);

  const { data: escrow, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: FAIRPAY_ABI,
    functionName: "getEscrow",
    args: [escrowId],
  }) as { data: EscrowData | undefined; refetch: () => void };

  const { data: isReviewTimeout } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: FAIRPAY_ABI,
    functionName: "isReviewTimeoutReached",
    args: [escrowId],
    query: { enabled: escrow?.state === 2 },
  });

  const { data: isDisputeTimeout } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: FAIRPAY_ABI,
    functionName: "isDisputeTimeoutReached",
    args: [escrowId],
    query: { enabled: escrow?.state === 3 },
  });

  const { data: isWorkDeadlineElapsed } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: FAIRPAY_ABI,
    functionName: "isWorkDeadlineElapsed",
    args: [escrowId],
    query: { enabled: escrow?.state === 1 },
  });

  const { writeContractAsync, isPending, data: txHash } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    timeout: 300_000,
  });

  useEffect(() => {
    if (isSuccess) {
      refetch();
      onRefresh?.();
    }
  }, [isSuccess]);

  const busy = isPending || isConfirming;

  function write(functionName: string, args: unknown[], value?: bigint) {
    writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: FAIRPAY_ABI,
      functionName: functionName as never,
      args: args as never,
      ...(value !== undefined ? { value } : {}),
    });
  }

  if (!escrow) {
    return (
      <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    );
  }

  const isClient = address?.toLowerCase() === escrow.client.toLowerCase();
  const isFreelancer = address?.toLowerCase() === escrow.freelancer.toLowerCase();
  const state = escrow.state;
  const isReleased = state === 4;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            #{escrowId.toString()}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_COLORS[state] ?? "bg-zinc-100 text-zinc-600"}`}
          >
            {STATE_LABELS[state] ?? "Unknown"}
          </span>
          {isClient && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
              Client
            </span>
          )}
          {isFreelancer && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              Freelancer
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {formatEther(escrow.amount)} tRBTC
          </span>
          <span className="text-zinc-400">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-100 px-4 pb-4 dark:border-zinc-800">
          {/* Details grid */}
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
            <div>
              <p className="text-zinc-500">Client</p>
              <p className="font-mono text-zinc-800 dark:text-zinc-200">
                {formatAddr(escrow.client)}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Freelancer</p>
              <p className="font-mono text-zinc-800 dark:text-zinc-200">
                {formatAddr(escrow.freelancer)}
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Amount</p>
              <p className="text-zinc-800 dark:text-zinc-200">
                {formatEther(escrow.amount)} tRBTC
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Work Deadline</p>
              <p className="text-zinc-800 dark:text-zinc-200">{formatDate(escrow.workDeadline)}</p>
            </div>
            <div>
              <p className="text-zinc-500">Review Period</p>
              <p className="text-zinc-800 dark:text-zinc-200">
                {Number(escrow.reviewPeriod) / 86400}d
              </p>
            </div>
            <div>
              <p className="text-zinc-500">Dispute Period</p>
              <p className="text-zinc-800 dark:text-zinc-200">
                {Number(escrow.disputePeriod) / 86400}d
              </p>
            </div>

            {/* Work link — only visible to client and freelancer */}
            {escrow.workLink && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-zinc-500">Work Submitted</p>
                {isClient || isFreelancer ? (
                  <LinkOrText value={escrow.workLink} />
                ) : (
                  <p className="italic text-zinc-400">Visible to participants only</p>
                )}
              </div>
            )}

            {/* Dispute reason — shown when in Disputed state */}
            {state === 3 && escrow.disputeReason && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-zinc-500">Dispute Reason</p>
                {isClient || isFreelancer ? (
                  <LinkOrText value={escrow.disputeReason} />
                ) : (
                  <p className="italic text-zinc-400">Visible to participants only</p>
                )}
              </div>
            )}

            {/* Dispute proof — only visible to client and freelancer */}
            {escrow.disputeResponded && escrow.disputeProof && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-zinc-500">Dispute Proof</p>
                {isClient || isFreelancer ? (
                  <LinkOrText value={escrow.disputeProof} />
                ) : (
                  <p className="italic text-zinc-400">Visible to participants only</p>
                )}
              </div>
            )}
          </div>

          {/* Status indicator */}
          {isPending && (
            <p className="mt-3 text-xs text-blue-600 dark:text-blue-400">
              Confirm in your wallet...
            </p>
          )}
          {isConfirming && txHash && (
            <p className="mt-3 text-xs text-yellow-600 dark:text-yellow-400">
              Transaction submitted — waiting for RSK confirmation...{" "}
              <a
                href={`https://explorer.testnet.rsk.co/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View tx
              </a>
            </p>
          )}

          {/* Actions */}
          {!isReleased && (
            <div className="mt-4 space-y-3">
              {/* CLIENT — State 0: Created → deposit */}
              {isClient && state === 0 && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="Amount (tRBTC)"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <ActionButton
                    label="Deposit"
                    disabled={busy || !depositAmount}
                    onClick={() =>
                      write("deposit", [escrowId], parseEther(depositAmount || "0"))
                    }
                  />
                </div>
              )}

              {/* CLIENT — State 1: Funded, cancel if deadline elapsed */}
              {isClient && state === 1 && isWorkDeadlineElapsed && (
                <ActionButton
                  label="Cancel & Refund"
                  variant="danger"
                  disabled={busy}
                  onClick={() => write("cancelEscrow", [escrowId])}
                />
              )}

              {/* FREELANCER — State 1: Funded → submit work link */}
              {isFreelancer && state === 1 && !isWorkDeadlineElapsed && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Paste your work URL or description"
                    value={workInput}
                    onChange={(e) => setWorkInput(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <ActionButton
                    label="Submit Work"
                    variant="success"
                    disabled={busy || !workInput.trim()}
                    onClick={() => write("submitWork", [escrowId, workInput.trim()])}
                  />
                </div>
              )}

              {/* CLIENT — State 2: UnderReview → approve or dispute */}
              {isClient && state === 2 && (
                <div className="space-y-2">
                  <ActionButton
                    label="Approve & Pay"
                    variant="success"
                    disabled={busy}
                    onClick={() => write("approve", [escrowId])}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Reason for dispute (required)"
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <ActionButton
                      label="Raise Dispute"
                      variant="danger"
                      disabled={busy || !disputeReason.trim()}
                      onClick={() => write("dispute", [escrowId, disputeReason.trim()])}
                    />
                  </div>
                </div>
              )}

              {/* ANYONE — State 2: review timeout → auto-pay freelancer */}
              {state === 2 && isReviewTimeout && (
                <ActionButton
                  label="Claim (Review Timeout)"
                  disabled={busy}
                  onClick={() => write("claimAfterReviewTimeout", [escrowId])}
                />
              )}

              {/* FREELANCER — State 3: Disputed → submit proof */}
              {isFreelancer && state === 3 && !escrow.disputeResponded && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Paste your proof URL or description"
                    value={proofInput}
                    onChange={(e) => setProofInput(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <ActionButton
                    label="Submit Proof"
                    variant="success"
                    disabled={busy || !proofInput.trim()}
                    onClick={() => write("submitDisputeProof", [escrowId, proofInput.trim()])}
                  />
                </div>
              )}

              {/* FREELANCER — State 3: can accept refund */}
              {isFreelancer && state === 3 && (
                <ActionButton
                  label="Accept Refund"
                  variant="danger"
                  disabled={busy}
                  onClick={() => write("acceptRefund", [escrowId])}
                />
              )}

              {/* CLIENT — State 3: approve dispute proof or withdraw */}
              {isClient && state === 3 && escrow.disputeResponded && (
                <div className="flex gap-2">
                  <ActionButton
                    label="Approve Proof & Pay"
                    variant="success"
                    disabled={busy}
                    onClick={() => write("approveAfterDispute", [escrowId])}
                  />
                  <ActionButton
                    label="Withdraw Dispute"
                    disabled={busy}
                    onClick={() => write("withdrawDispute", [escrowId])}
                  />
                </div>
              )}

              {/* ANYONE — State 3: dispute timeout */}
              {state === 3 && isDisputeTimeout && (
                <ActionButton
                  label="Claim (Dispute Timeout)"
                  disabled={busy}
                  onClick={() => write("claimAfterDisputeTimeout", [escrowId])}
                />
              )}
            </div>
          )}

          {isReleased && (
            <p className="mt-3 text-center text-xs text-green-600 dark:text-green-400">
              This escrow has been settled.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
