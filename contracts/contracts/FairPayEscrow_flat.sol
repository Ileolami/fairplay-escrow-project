

// Sources flattened with hardhat v2.28.6 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/StorageSlot.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (utils/StorageSlot.sol)
// This file was procedurally generated from scripts/generate/templates/StorageSlot.js.

pragma solidity ^0.8.20;

/**
 * @dev Library for reading and writing primitive types to specific storage slots.
 *
 * Storage slots are often used to avoid storage conflict when dealing with upgradeable contracts.
 * This library helps with reading and writing to such slots without the need for inline assembly.
 *
 * The functions in this library return Slot structs that contain a `value` member that can be used to read or write.
 *
 * Example usage to set ERC-1967 implementation slot:
 * ```solidity
 * contract ERC1967 {
 *     // Define the slot. Alternatively, use the SlotDerivation library to derive the slot.
 *     bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
 *
 *     function _getImplementation() internal view returns (address) {
 *         return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
 *     }
 *
 *     function _setImplementation(address newImplementation) internal {
 *         require(newImplementation.code.length > 0);
 *         StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value = newImplementation;
 *     }
 * }
 * ```
 *
 * TIP: Consider using this library along with {SlotDerivation}.
 */
library StorageSlot {
    struct AddressSlot {
        address value;
    }

    struct BooleanSlot {
        bool value;
    }

    struct Bytes32Slot {
        bytes32 value;
    }

    struct Uint256Slot {
        uint256 value;
    }

    struct Int256Slot {
        int256 value;
    }

    struct StringSlot {
        string value;
    }

    struct BytesSlot {
        bytes value;
    }

    /**
     * @dev Returns an `AddressSlot` with member `value` located at `slot`.
     */
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `BooleanSlot` with member `value` located at `slot`.
     */
    function getBooleanSlot(bytes32 slot) internal pure returns (BooleanSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Bytes32Slot` with member `value` located at `slot`.
     */
    function getBytes32Slot(bytes32 slot) internal pure returns (Bytes32Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Uint256Slot` with member `value` located at `slot`.
     */
    function getUint256Slot(bytes32 slot) internal pure returns (Uint256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `Int256Slot` with member `value` located at `slot`.
     */
    function getInt256Slot(bytes32 slot) internal pure returns (Int256Slot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns a `StringSlot` with member `value` located at `slot`.
     */
    function getStringSlot(bytes32 slot) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `StringSlot` representation of the string storage pointer `store`.
     */
    function getStringSlot(string storage store) internal pure returns (StringSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }

    /**
     * @dev Returns a `BytesSlot` with member `value` located at `slot`.
     */
    function getBytesSlot(bytes32 slot) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := slot
        }
    }

    /**
     * @dev Returns an `BytesSlot` representation of the bytes storage pointer `store`.
     */
    function getBytesSlot(bytes storage store) internal pure returns (BytesSlot storage r) {
        assembly ("memory-safe") {
            r.slot := store.slot
        }
    }
}


// File @openzeppelin/contracts/utils/ReentrancyGuard.sol@v5.6.1

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.5.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 *
 * IMPORTANT: Deprecated. This storage-based reentrancy guard will be removed and replaced
 * by the {ReentrancyGuardTransient} variant in v6.0.
 *
 * @custom:stateless
 */
abstract contract ReentrancyGuard {
    using StorageSlot for bytes32;

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant REENTRANCY_GUARD_STORAGE =
        0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    /**
     * @dev A `view` only version of {nonReentrant}. Use to block view functions
     * from being called, preventing reading from inconsistent contract state.
     *
     * CAUTION: This is a "view" modifier and does not change the reentrancy
     * status. Use it only on view functions. For payable or non-payable functions,
     * use the standard {nonReentrant} modifier instead.
     */
    modifier nonReentrantView() {
        _nonReentrantBeforeView();
        _;
    }

    function _nonReentrantBeforeView() private view {
        if (_reentrancyGuardEntered()) {
            revert ReentrancyGuardReentrantCall();
        }
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        _nonReentrantBeforeView();

        // Any calls to nonReentrant after this point will fail
        _reentrancyGuardStorageSlot().getUint256Slot().value = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _reentrancyGuardStorageSlot().getUint256Slot().value = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _reentrancyGuardStorageSlot().getUint256Slot().value == ENTERED;
    }

    function _reentrancyGuardStorageSlot() internal pure virtual returns (bytes32) {
        return REENTRANCY_GUARD_STORAGE;
    }
}


// File contracts/FairPayTypes.sol

// Original license: SPDX_License_Identifier: MIT
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


// File contracts/FairPayEscrow.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.28;


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
    event WorkSubmitted(uint256 indexed escrowId, address indexed freelancer, bytes32 workHash);
    event Approved(uint256 indexed escrowId, address indexed client, uint256 amount);
    event ReviewTimeoutClaimed(uint256 indexed escrowId, address indexed caller, uint256 amount);
    event DisputeRaised(uint256 indexed escrowId, address indexed client, uint256 disputeDeadline);
    event DisputeProofSubmitted(uint256 indexed escrowId, address indexed freelancer, bytes32 proofHash);
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

    /// @notice Freelancer submits a keccak256 hash of their deliverable. Starts review timer.
    function submitWork(uint256 escrowId, bytes32 _workHash)
        external
        escrowExists(escrowId)
        onlyFreelancer(escrowId)
        inState(escrowId, State.Funded)
    {
        Escrow storage e = escrows[escrowId];
        if (block.timestamp >= e.workDeadline) revert WorkDeadlineElapsed();
        if (_workHash == bytes32(0)) revert EmptyWorkHash();
        e.workHash            = _workHash;
        e.submissionTimestamp = block.timestamp;
        e.state               = State.UnderReview;
        emit WorkSubmitted(escrowId, msg.sender, _workHash);
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

    /// @notice Client raises a dispute during the review window.
    function dispute(uint256 escrowId)
        external
        escrowExists(escrowId)
        onlyClient(escrowId)
        inState(escrowId, State.UnderReview)
    {
        Escrow storage e = escrows[escrowId];
        e.disputeDeadline  = block.timestamp + e.disputePeriod;
        e.disputeResponded = false;
        e.disputeProofHash = bytes32(0);
        e.state = State.Disputed;
        emit DisputeRaised(escrowId, msg.sender, e.disputeDeadline);
    }

    /// @notice Freelancer submits proof during dispute.
    ///         Resets the dispute deadline so the client gets a full disputePeriod
    ///         to review the proof. Only one response allowed per dispute.
    function submitDisputeProof(uint256 escrowId, bytes32 _proofHash)
        external
        escrowExists(escrowId)
        onlyFreelancer(escrowId)
        inState(escrowId, State.Disputed)
    {
        Escrow storage e = escrows[escrowId];
        if (_proofHash == bytes32(0)) revert EmptyWorkHash();
        if (e.disputeResponded) revert FreelancerAlreadyResponded();
        e.disputeProofHash = _proofHash;
        e.disputeResponded = true;
        e.disputeDeadline  = block.timestamp + e.disputePeriod;
        emit DisputeProofSubmitted(escrowId, msg.sender, _proofHash);
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
        e.disputeProofHash = bytes32(0);
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
