// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./FairPayTypes.sol";

/// @title FairPayEscrow
/// @author Ileolami
/// @notice A factory-style, time-bound, worker-protective escrow protocol.
///         A single deployed contract manages all escrows via a mapping.
///
///         Three symmetric rules govern outcomes:
///           1. Silence from CLIENT during review  → freelancer auto-paid (consent)
///           2. Silence from FREELANCER during dispute → client auto-refunded (abandonment)
///           3. Freelancer responds to dispute + client silent → freelancer auto-paid (defended)
contract FairPayEscrow is ReentrancyGuard {

    // ─────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────

    mapping(uint256 => Escrow) private escrows;
    uint256 public escrowCount;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event EscrowCreated(uint256 indexed escrowId, address indexed client, address indexed freelancer);
    event Deposited(uint256 indexed escrowId, address indexed client, uint256 amount);
    event EscrowCancelled(uint256 indexed escrowId, address indexed client, uint256 amount);
    event WorkSubmitted(uint256 indexed escrowId, address indexed freelancer, string workLink);
    event Approved(uint256 indexed escrowId, address indexed client, uint256 amount);
    event ReviewTimeoutClaimed(uint256 indexed escrowId, address indexed caller, uint256 amount);
    event DisputeRaised(uint256 indexed escrowId, address indexed client, uint256 disputeDeadline, string reason);
    event DisputeProofSubmitted(uint256 indexed escrowId, address indexed freelancer, string proofLink);
    event DisputeApproved(uint256 indexed escrowId, address indexed client, uint256 amount);
    event DisputeWithdrawn(uint256 indexed escrowId, address indexed client);
    event RefundAccepted(uint256 indexed escrowId, address indexed freelancer, uint256 amount);
    event DisputeTimeoutRefunded(uint256 indexed escrowId, address indexed caller, uint256 amount);
    event DisputeTimeoutReleased(uint256 indexed escrowId, address indexed caller, uint256 amount);

    // ─────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────

    modifier onlyClient(uint256 escrowId) {
        if (msg.sender != escrows[escrowId].client) revert OnlyClient();
        _;
    }

    modifier onlyFreelancer(uint256 escrowId) {
        if (msg.sender != escrows[escrowId].freelancer) revert OnlyFreelancer();
        _;
    }

    modifier inState(uint256 escrowId, State expected) {
        State actual = escrows[escrowId].state;
        if (actual != expected) revert UnexpectedState(expected, actual);
        _;
    }

    /// @dev We use client == address(0) as the existence check because
    ///      createEscrow() guarantees client is never zero.
    modifier escrowExists(uint256 escrowId) {
        if (escrows[escrowId].client == address(0)) revert EscrowNotFound();
        _;
    }

    // ─────────────────────────────────────────────
    // Create & Fund
    // ─────────────────────────────────────────────

    /// @notice Creates a new escrow agreement.
    /// @param _freelancer    Address of the worker
    /// @param _reviewPeriod  Seconds the client has to review work (e.g. 604800 = 7 days)
    /// @param _disputePeriod Seconds each party has to respond during dispute (e.g. 259200 = 3 days)
    /// @param _workDuration  Seconds the freelancer has to submit work after deposit (e.g. 1209600 = 14 days)
    /// @return escrowId The ID of the newly created escrow
    function createEscrow(
        address _freelancer,
        uint256 _reviewPeriod,
        uint256 _disputePeriod,
        uint256 _workDuration
    ) external returns (uint256 escrowId) {
        if (_freelancer == address(0)) revert ZeroAddress();
        if (_reviewPeriod == 0) revert ZeroPeriod();
        if (_disputePeriod == 0) revert ZeroPeriod();
        if (_workDuration == 0) revert ZeroPeriod();
        if (_freelancer == msg.sender) revert ClientFreelancerSame();

        escrowId = escrowCount++;
        Escrow storage e = escrows[escrowId];
        e.client        = msg.sender;
        e.freelancer    = _freelancer;
        e.reviewPeriod  = _reviewPeriod;
        e.disputePeriod = _disputePeriod;
        e.workDuration  = _workDuration;
        e.state         = State.Created;

        emit EscrowCreated(escrowId, msg.sender, _freelancer);
    }

    /// @notice Client deposits the agreed payment into escrow. Sets the work deadline.
    function deposit(uint256 escrowId)
        external
        payable
        escrowExists(escrowId)
        onlyClient(escrowId)
        inState(escrowId, State.Created)
    {
        if (msg.value == 0) revert ZeroDeposit();
        Escrow storage e = escrows[escrowId];
        e.amount       = msg.value;
        e.workDeadline = block.timestamp + e.workDuration; // clock starts now — freelancer must deliver before this
        e.state        = State.Funded;
        emit Deposited(escrowId, msg.sender, msg.value);
    }

    // ─────────────────────────────────────────────
    // Cancel
    // ─────────────────────────────────────────────

    /// @notice Client cancels escrow after work deadline passes without submission.
    function cancelEscrow(uint256 escrowId)
        external
        escrowExists(escrowId)
        onlyClient(escrowId)
        inState(escrowId, State.Funded)
        nonReentrant
    {
        Escrow storage e = escrows[escrowId];
        if (block.timestamp < e.workDeadline) revert WorkDeadlineNotElapsed();
        uint256 payout = e.amount;
        e.state  = State.Released;
        e.amount = 0;
        (bool ok, ) = e.client.call{value: payout}("");
        if (!ok) revert TransferFailed();
        emit EscrowCancelled(escrowId, msg.sender, payout);
    }

    // ─────────────────────────────────────────────
    // Work submission & Review
    // ─────────────────────────────────────────────

    /// @notice Freelancer submits a link or description of their deliverable. Starts review timer.
    function submitWork(uint256 escrowId, string calldata _workLink)
        external
        escrowExists(escrowId)
        onlyFreelancer(escrowId)
        inState(escrowId, State.Funded)
    {
        Escrow storage e = escrows[escrowId];
        if (block.timestamp >= e.workDeadline) revert WorkDeadlineElapsed();
        if (bytes(_workLink).length == 0) revert EmptyWorkLink();
        e.workLink            = _workLink;
        e.submissionTimestamp = block.timestamp;
        e.state               = State.UnderReview;
        emit WorkSubmitted(escrowId, msg.sender, _workLink);
    }

    /// @notice Client approves the work. Pays freelancer immediately.
    function approve(uint256 escrowId)
        external
        escrowExists(escrowId)
        onlyClient(escrowId)
        inState(escrowId, State.UnderReview)
        nonReentrant
    {
        Escrow storage e = escrows[escrowId];
        uint256 payout = e.amount;
        e.state  = State.Released;
        e.amount = 0;
        (bool ok, ) = e.freelancer.call{value: payout}("");
        if (!ok) revert TransferFailed();
        emit Approved(escrowId, msg.sender, payout);
    }

    /// @notice Auto-release to freelancer after review period. Callable by anyone.
    ///         Permissionless so bots or the freelancer themselves can trigger it.
    function claimAfterReviewTimeout(uint256 escrowId)
        external
        escrowExists(escrowId)
        inState(escrowId, State.UnderReview)
        nonReentrant
    {
        Escrow storage e = escrows[escrowId];
        if (block.timestamp < e.submissionTimestamp + e.reviewPeriod)
            revert ReviewPeriodNotElapsed();
        uint256 payout = e.amount;
        e.state  = State.Released;
        e.amount = 0;
        (bool ok, ) = e.freelancer.call{value: payout}("");
        if (!ok) revert TransferFailed();
        emit ReviewTimeoutClaimed(escrowId, msg.sender, payout);
    }

    // ─────────────────────────────────────────────
    // Dispute flow
    // ─────────────────────────────────────────────

    /// @notice Client raises a dispute during the review window with a reason.
    function dispute(uint256 escrowId, string calldata _reason)
        external
        escrowExists(escrowId)
        onlyClient(escrowId)
        inState(escrowId, State.UnderReview)
    {
        if (bytes(_reason).length == 0) revert EmptyWorkLink();
        Escrow storage e = escrows[escrowId];
        e.disputeDeadline  = block.timestamp + e.disputePeriod;
        e.disputeResponded = false;
        e.disputeReason    = _reason;
        e.disputeProof     = "";
        e.state = State.Disputed;
        emit DisputeRaised(escrowId, msg.sender, e.disputeDeadline, _reason);
    }

    /// @notice Freelancer submits proof during dispute.
    ///         Resets the dispute deadline so the client gets a full disputePeriod
    ///         to review the proof. Only one response allowed per dispute.
    function submitDisputeProof(uint256 escrowId, string calldata _proofLink)
        external
        escrowExists(escrowId)
        onlyFreelancer(escrowId)
        inState(escrowId, State.Disputed)
    {
        Escrow storage e = escrows[escrowId];
        if (bytes(_proofLink).length == 0) revert EmptyWorkLink();
        if (e.disputeResponded) revert FreelancerAlreadyResponded();
        e.disputeProof     = _proofLink;
        e.disputeResponded = true;
        e.disputeDeadline  = block.timestamp + e.disputePeriod;
        emit DisputeProofSubmitted(escrowId, msg.sender, _proofLink);
    }

    /// @notice Client approves freelancer's dispute proof. Pays freelancer.
    function approveAfterDispute(uint256 escrowId)
        external
        escrowExists(escrowId)
        onlyClient(escrowId)
        inState(escrowId, State.Disputed)
        nonReentrant
    {
        Escrow storage e = escrows[escrowId];
        if (!e.disputeResponded) revert DisputeNotResponded();
        uint256 payout = e.amount;
        e.state  = State.Released;
        e.amount = 0;
        (bool ok, ) = e.freelancer.call{value: payout}("");
        if (!ok) revert TransferFailed();
        emit DisputeApproved(escrowId, msg.sender, payout);
    }

    /// @notice Client withdraws dispute. Returns to UnderReview.
    ///         Original review deadline is NOT reset — remaining review time continues.
    ///         Dispute state is fully cleared so a fresh dispute can be raised later.
    function withdrawDispute(uint256 escrowId)
        external
        escrowExists(escrowId)
        onlyClient(escrowId)
        inState(escrowId, State.Disputed)
    {
        Escrow storage e = escrows[escrowId];
        e.disputeDeadline  = 0;
        e.disputeResponded = false;
        e.disputeReason    = "";
        e.disputeProof     = "";
        e.state = State.UnderReview;
        emit DisputeWithdrawn(escrowId, msg.sender);
    }

    /// @notice Freelancer voluntarily accepts refund during dispute.
    function acceptRefund(uint256 escrowId)
        external
        escrowExists(escrowId)
        onlyFreelancer(escrowId)
        inState(escrowId, State.Disputed)
        nonReentrant
    {
        Escrow storage e = escrows[escrowId];
        uint256 payout = e.amount;
        e.state  = State.Released;
        e.amount = 0;
        (bool ok, ) = e.client.call{value: payout}("");
        if (!ok) revert TransferFailed();
        emit RefundAccepted(escrowId, msg.sender, payout);
    }

    /// @notice Claim after dispute deadline. Outcome depends on freelancer's response:
    ///         - No response → client refunded (abandonment)
    ///         - Responded + client silent → freelancer paid (defended)
    function claimAfterDisputeTimeout(uint256 escrowId)
        external
        escrowExists(escrowId)
        inState(escrowId, State.Disputed)
        nonReentrant
    {
        Escrow storage e = escrows[escrowId];
        if (block.timestamp < e.disputeDeadline) revert DisputePeriodNotElapsed();

        uint256 payout = e.amount;
        e.state  = State.Released;
        e.amount = 0;

        if (e.disputeResponded) {
            // Freelancer defended their work, client stayed silent → freelancer wins
            (bool ok, ) = e.freelancer.call{value: payout}("");
            if (!ok) revert TransferFailed();
            emit DisputeTimeoutReleased(escrowId, msg.sender, payout);
        } else {
            // Freelancer never responded → treated as abandonment, client refunded
            (bool ok, ) = e.client.call{value: payout}("");
            if (!ok) revert TransferFailed();
            emit DisputeTimeoutRefunded(escrowId, msg.sender, payout);
        }
    }

    // ─────────────────────────────────────────────
    // View helpers
    // ─────────────────────────────────────────────

    /// @notice Returns the full escrow data for a given ID.
    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        if (escrows[escrowId].client == address(0)) revert EscrowNotFound();
        return escrows[escrowId];
    }

    /// @notice Returns the review deadline timestamp (0 if work not yet submitted).
    function reviewDeadline(uint256 escrowId) external view returns (uint256) {
        Escrow storage e = escrows[escrowId];
        if (e.submissionTimestamp == 0) return 0;
        return e.submissionTimestamp + e.reviewPeriod;
    }

    function isReviewTimeoutReached(uint256 escrowId) external view returns (bool) {
        Escrow storage e = escrows[escrowId];
        if (e.state != State.UnderReview) return false;
        return block.timestamp >= e.submissionTimestamp + e.reviewPeriod;
    }

    function isDisputeTimeoutReached(uint256 escrowId) external view returns (bool) {
        Escrow storage e = escrows[escrowId];
        if (e.state != State.Disputed) return false;
        return block.timestamp >= e.disputeDeadline;
    }

    function isWorkDeadlineElapsed(uint256 escrowId) external view returns (bool) {
        Escrow storage e = escrows[escrowId];
        if (e.state != State.Funded) return false;
        return block.timestamp >= e.workDeadline;
    }
}
