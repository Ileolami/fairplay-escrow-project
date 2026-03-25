// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title FairPayEscrow
/// @author Ileolami
/// @notice A time-bound, worker-protective escrow protocol.
///         The contract itself is the neutral middleman — no human arbiter required.
///
///         Two symmetric rules govern outcomes:
///           1. Silence from CLIENT during review  → freelancer auto-paid (consent)
///           2. Silence from FREELANCER during dispute → client auto-refunded (abandonment)
contract FairPayEscrow is ReentrancyGuard {

    // ─────────────────────────────────────────────
    // State machine
    // ─────────────────────────────────────────────

    enum State {
        Created,     // contract deployed, awaiting client deposit
        Funded,      // client deposited funds, awaiting work submission
        UnderReview, // freelancer submitted work, review window open
        Disputed,    // client raised a dispute, freelancer must respond
        Released     // funds fully released to one party (terminal)
    }

    // ─────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────

    address public immutable client;
    address public immutable freelancer;

    uint256 public amount;
    State   public state;

    bytes32 public workHash;
    uint256 public submissionTimestamp;

    uint256 public immutable reviewPeriod;   // seconds client has to review work
    uint256 public immutable disputePeriod;  // seconds freelancer has to respond to dispute

    uint256 public disputeDeadline;          // set when dispute() is called

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event Deposited(address indexed client, uint256 amount);
    event WorkSubmitted(address indexed freelancer, bytes32 workHash, uint256 timestamp);
    event Approved(address indexed client, uint256 amount);
    event ReviewTimeoutClaimed(address indexed caller, uint256 amount);
    event DisputeRaised(address indexed client, uint256 disputeDeadline);
    event DisputeWithdrawn(address indexed client);
    event RefundAccepted(address indexed freelancer, uint256 amount);
    event DisputeTimeoutRefundClaimed(address indexed caller, uint256 amount);

    // ─────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────

    modifier onlyClient() {
        require(msg.sender == client, "FairPay: caller is not the client");
        _;
    }

    modifier onlyFreelancer() {
        require(msg.sender == freelancer, "FairPay: caller is not the freelancer");
        _;
    }

    error UnexpectedState(State expected, State actual);

    modifier inState(State expected) {
        if (state != expected) revert UnexpectedState(expected, state);
        _;
    }

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    /// @param _freelancer   Address of the worker who will perform the service
    /// @param _reviewPeriod Seconds the client has to review submitted work before
    ///                      funds auto-release to the freelancer (e.g. 604800 = 7 days)
    /// @param _disputePeriod Seconds the freelancer has to respond to a dispute before
    ///                       funds auto-refund to the client (e.g. 259200 = 3 days)
    constructor(
        address _freelancer,
        uint256 _reviewPeriod,
        uint256 _disputePeriod
    ) {
        require(_freelancer  != address(0), "FairPay: zero freelancer address");
        require(_reviewPeriod  > 0,         "FairPay: review period must be > 0");
        require(_disputePeriod > 0,         "FairPay: dispute period must be > 0");
        require(_freelancer != msg.sender,  "FairPay: client and freelancer must differ");

        client        = msg.sender;
        freelancer    = _freelancer;
        reviewPeriod  = _reviewPeriod;
        disputePeriod = _disputePeriod;
        state         = State.Created;
    }

    // ─────────────────────────────────────────────
    // State transitions
    // ─────────────────────────────────────────────

    /// @notice Client deposits the agreed payment into escrow.
    ///         The value sent (in wei) becomes the locked amount.
    function deposit()
        external
        payable
        onlyClient
        inState(State.Created)
    {
        require(msg.value > 0, "FairPay: deposit must be > 0");
        amount = msg.value;
        state  = State.Funded;
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Freelancer submits a keccak256 hash of their deliverable.
    ///         The real file lives off-chain (IPFS, GitHub, etc.). The hash
    ///         is the immutable, on-chain proof of what was submitted and when.
    ///         Starts the review-window timer.
    /// @param _workHash keccak256 hash of the submitted work artifact
    function submitWork(bytes32 _workHash)
        external
        onlyFreelancer
        inState(State.Funded)
    {
        require(_workHash != bytes32(0), "FairPay: empty work hash");
        workHash            = _workHash;
        submissionTimestamp = block.timestamp;
        state               = State.UnderReview;
        emit WorkSubmitted(msg.sender, _workHash, block.timestamp);
    }

    /// @notice Client explicitly approves the work. Releases full payment to freelancer.
    function approve()
        external
        onlyClient
        inState(State.UnderReview)
        nonReentrant
    {
        uint256 payout = amount;
        // checks-effects-interactions: state updated before external call
        state  = State.Released;
        amount = 0;
        (bool ok, ) = freelancer.call{value: payout}("");
        require(ok, "FairPay: transfer to freelancer failed");
        emit Approved(msg.sender, payout);
    }

    /// @notice Anyone can trigger auto-release once the review period elapses without
    ///         client action. Silence from client = consent. Funds go to freelancer.
    ///         NOTE: block.timestamp can be manipulated ~15 s by validators — negligible
    ///         for multi-day review windows (< 0.003% variance for 7 days).
    function claimAfterReviewTimeout()
        external
        inState(State.UnderReview)
        nonReentrant
    {
        require(
            block.timestamp >= submissionTimestamp + reviewPeriod,
            "FairPay: review period has not elapsed"
        );
        uint256 payout = amount;
        // checks-effects-interactions
        state  = State.Released;
        amount = 0;
        (bool ok, ) = freelancer.call{value: payout}("");
        require(ok, "FairPay: transfer to freelancer failed");
        emit ReviewTimeoutClaimed(msg.sender, payout);
    }

    /// @notice Client raises a dispute during the review window.
    ///         The freelancer now has `disputePeriod` seconds to either accept the
    ///         refund or do nothing (which auto-refunds the client).
    function dispute()
        external
        onlyClient
        inState(State.UnderReview)
    {
        disputeDeadline = block.timestamp + disputePeriod;
        state = State.Disputed;
        emit DisputeRaised(msg.sender, disputeDeadline);
    }

    /// @notice Freelancer accepts the dispute and voluntarily refunds the client.
    ///         Use this when the freelancer acknowledges the work was unsatisfactory.
    function acceptRefund()
        external
        onlyFreelancer
        inState(State.Disputed)
        nonReentrant
    {
        uint256 payout = amount;
        // checks-effects-interactions
        state  = State.Released;
        amount = 0;
        (bool ok, ) = client.call{value: payout}("");
        require(ok, "FairPay: refund to client failed");
        emit RefundAccepted(msg.sender, payout);
    }

    /// @notice Client withdraws the dispute and returns the contract to UnderReview.
    ///         Use this when the client is satisfied after re-examining the work.
    ///         The original review deadline is NOT reset — remaining time continues unchanged.
    function withdrawDispute()
        external
        onlyClient
        inState(State.Disputed)
    {
        disputeDeadline = 0;
        state = State.UnderReview;
        emit DisputeWithdrawn(msg.sender);
    }

    /// @notice Anyone can trigger an auto-refund to the client once the dispute period
    ///         elapses without the freelancer responding.
    ///         Silence from freelancer during a dispute = abandonment. Funds go to client.
    function claimRefundAfterDisputeTimeout()
        external
        inState(State.Disputed)
        nonReentrant
    {
        require(
            block.timestamp >= disputeDeadline,
            "FairPay: dispute period has not elapsed"
        );
        uint256 payout = amount;
        // checks-effects-interactions
        state  = State.Released;
        amount = 0;
        (bool ok, ) = client.call{value: payout}("");
        require(ok, "FairPay: refund to client failed");
        emit DisputeTimeoutRefundClaimed(msg.sender, payout);
    }

    // ─────────────────────────────────────────────
    // View helpers
    // ─────────────────────────────────────────────

    /// @notice Returns the UNIX timestamp at which the review window closes.
    ///         Returns 0 if work has not been submitted yet.
    function reviewDeadline() external view returns (uint256) {
        if (submissionTimestamp == 0) return 0;
        return submissionTimestamp + reviewPeriod;
    }

    /// @notice Returns true if the review period has elapsed and auto-release can be triggered.
    function isReviewTimeoutReached() external view returns (bool) {
        if (state != State.UnderReview) return false;
        return block.timestamp >= submissionTimestamp + reviewPeriod;
    }

    /// @notice Returns true if the dispute period has elapsed and auto-refund can be triggered.
    function isDisputeTimeoutReached() external view returns (bool) {
        if (state != State.Disputed) return false;
        return block.timestamp >= disputeDeadline;
    }
}
