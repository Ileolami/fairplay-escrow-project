// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title FairPayEscrow
/// @notice A time-bound, worker-protective escrow protocol.
///         If the client does not act within the review window, funds
///         automatically release to the freelancer — silence becomes consent.
contract FairPayEscrow is ReentrancyGuard {
    // ─────────────────────────────────────────────
    // State machine
    // ─────────────────────────────────────────────

    enum State {
        Created,     // contract deployed, awaiting deposit
        Funded,      // client deposited funds, awaiting work submission
        UnderReview, // freelancer submitted work, 7-day review window open
        Released,    // funds released (terminal)
        Disputed     // client raised a dispute, awaiting arbiter
    }

    // ─────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────

    address public immutable client;
    address public immutable freelancer;
    address public immutable arbiter;

    uint256 public amount;
    State   public state;

    bytes32 public workHash;
    uint256 public submissionTimestamp;
    uint256 public immutable reviewPeriod;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event Deposited(address indexed client, uint256 amount);
    event WorkSubmitted(address indexed freelancer, bytes32 workHash, uint256 timestamp);
    event Approved(address indexed client, uint256 amount);
    event Disputed(address indexed client);
    event DisputeResolved(address indexed arbiter, bool freelancerWins, uint256 amount);
    event TimeoutClaimed(address indexed caller, uint256 amount);

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

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "FairPay: caller is not the arbiter");
        _;
    }

    modifier inState(State expected) {
        require(state == expected, "FairPay: invalid state for this action");
        _;
    }

    // ─────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────

    /// @param _freelancer Address of the worker who will perform the service
    /// @param _arbiter    Trusted address that resolves disputes (MVP: single EOA)
    /// @param _reviewPeriod Seconds the client has to review work before auto-release
    ///                      (e.g. 604800 = 7 days)
    constructor(
        address _freelancer,
        address _arbiter,
        uint256 _reviewPeriod
    ) {
        require(_freelancer != address(0), "FairPay: zero freelancer address");
        require(_arbiter   != address(0), "FairPay: zero arbiter address");
        require(_reviewPeriod > 0,        "FairPay: review period must be > 0");
        require(
            _freelancer != msg.sender,
            "FairPay: client and freelancer must differ"
        );

        client       = msg.sender;
        freelancer   = _freelancer;
        arbiter      = _arbiter;
        reviewPeriod = _reviewPeriod;
        state        = State.Created;
    }

    // ─────────────────────────────────────────────
    // State transitions
    // ─────────────────────────────────────────────

    /// @notice Client deposits the agreed payment into escrow.
    ///         The value sent becomes the escrowed amount.
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

    /// @notice Freelancer submits a hash of their deliverable (off-chain reference).
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

    /// @notice Client explicitly approves the work and releases funds to freelancer.
    function approve()
        external
        onlyClient
        inState(State.UnderReview)
        nonReentrant
    {
        uint256 payout = amount;
        // checks-effects-interactions
        state  = State.Released;
        amount = 0;
        (bool ok, ) = freelancer.call{value: payout}("");
        require(ok, "FairPay: transfer to freelancer failed");
        emit Approved(msg.sender, payout);
    }

    /// @notice Client raises a dispute during the review window.
    ///         Hands control to the arbiter.
    function dispute()
        external
        onlyClient
        inState(State.UnderReview)
    {
        state = State.Disputed;
        emit Disputed(msg.sender);
    }

    /// @notice Anyone can trigger this once the review period has elapsed without
    ///         client action. Funds auto-release to the freelancer.
    ///         NOTE: block.timestamp can be manipulated ~15 s by miners; negligible
    ///         for a 7-day window (< 0.003% variance).
    function claimAfterTimeout()
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
        emit TimeoutClaimed(msg.sender, payout);
    }

    /// @notice Arbiter resolves a dispute and routes funds to the winner.
    /// @param freelancerWins If true, freelancer receives funds; otherwise client does.
    function resolveDispute(bool freelancerWins)
        external
        onlyArbiter
        inState(State.Disputed)
        nonReentrant
    {
        uint256 payout  = amount;
        address winner  = freelancerWins ? freelancer : client;
        // checks-effects-interactions
        state  = State.Released;
        amount = 0;
        (bool ok, ) = winner.call{value: payout}("");
        require(ok, "FairPay: transfer to winner failed");
        emit DisputeResolved(msg.sender, freelancerWins, payout);
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

    /// @notice Returns true if the review period has elapsed and funds can be claimed.
    function isTimeoutReached() external view returns (bool) {
        if (state != State.UnderReview) return false;
        return block.timestamp >= submissionTimestamp + reviewPeriod;
    }
}
