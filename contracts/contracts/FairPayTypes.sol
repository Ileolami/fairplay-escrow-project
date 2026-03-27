// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title FairPayTypes
/// @notice Shared types, errors, and events for the FairPay Escrow protocol.

// ─────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────

enum State {
    Created,     // escrow created, awaiting client deposit
    Funded,      // client deposited funds, awaiting work submission
    UnderReview, // freelancer submitted work, review window open
    Disputed,    // client raised a dispute, freelancer must respond
    Released     // funds released to one party (terminal)
}

// ─────────────────────────────────────────────
// Escrow data structure
// ─────────────────────────────────────────────

struct Escrow {
    address client;
    address freelancer;
    uint256 amount;
    State   state;
    bytes32 workHash;
    uint256 submissionTimestamp;
    uint256 reviewPeriod;
    uint256 disputePeriod;
    uint256 workDuration;
    uint256 workDeadline;
    uint256 disputeDeadline;
    bool    disputeResponded;
    bytes32 disputeProofHash;
}

// ─────────────────────────────────────────────
// Custom errors
// ─────────────────────────────────────────────

error OnlyClient();
error OnlyFreelancer();
error UnexpectedState(State expected, State actual);
error ZeroAddress();
error ZeroPeriod();
error ClientFreelancerSame();
error ZeroDeposit();
error EmptyWorkHash();
error ReviewPeriodNotElapsed();
error DisputePeriodNotElapsed();
error TransferFailed();
error FreelancerAlreadyResponded();
error DisputeNotResponded();
error WorkDeadlineNotElapsed();
error WorkDeadlineElapsed();
error EscrowNotFound();
