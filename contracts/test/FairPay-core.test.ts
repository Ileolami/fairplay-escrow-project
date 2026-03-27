import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("FairPayEscrow — Core", function () {
  const REVIEW_PERIOD   = 7 * 24 * 60 * 60;
  const DISPUTE_PERIOD  = 3 * 24 * 60 * 60;
  const WORK_DURATION   = 14 * 24 * 60 * 60;
  const DEPOSIT         = hre.ethers.parseEther("1.0");
  const WORK_LINK       = "https://github.com/user/deliverable";
  const DISPUTE_REASON  = "Work does not meet requirements";
  const PROOF_LINK      = "https://proof.example.com/v1";

  const State = { Created: 0, Funded: 1, UnderReview: 2, Disputed: 3, Released: 4 };

  // ─── Fixtures ──────────────────────────────────

  async function deployFixture() {
    const [client, freelancer, outsider] = await hre.ethers.getSigners();
    const Factory = await hre.ethers.getContractFactory("FairPayEscrow");
    const contract = await Factory.deploy();
    return { contract, client, freelancer, outsider };
  }

  async function createdFixture() {
    const base = await deployFixture();
    await base.contract.connect(base.client).createEscrow(
      base.freelancer.address, REVIEW_PERIOD, DISPUTE_PERIOD, WORK_DURATION
    );
    return { ...base, escrowId: 0 };
  }

  async function fundedFixture() {
    const base = await createdFixture();
    await base.contract.connect(base.client).deposit(base.escrowId, { value: DEPOSIT });
    return base;
  }

  async function underReviewFixture() {
    const base = await fundedFixture();
    await base.contract.connect(base.freelancer).submitWork(base.escrowId, WORK_LINK);
    return base;
  }

  async function disputedFixture() {
    const base = await underReviewFixture();
    await base.contract.connect(base.client).dispute(base.escrowId, DISPUTE_REASON);
    return base;
  }

  // ─── Create Escrow ─────────────────────────────

  describe("Create Escrow", function () {
    it("should create escrow with correct data", async function () {
      const { contract, client, freelancer } = await loadFixture(deployFixture);

      await expect(
        contract.connect(client).createEscrow(
          freelancer.address, REVIEW_PERIOD, DISPUTE_PERIOD, WORK_DURATION
        )
      ).to.emit(contract, "EscrowCreated").withArgs(0, client.address, freelancer.address);

      const e = await contract.getEscrow(0);
      expect(e.client).to.equal(client.address);
      expect(e.freelancer).to.equal(freelancer.address);
      expect(e.reviewPeriod).to.equal(REVIEW_PERIOD);
      expect(e.disputePeriod).to.equal(DISPUTE_PERIOD);
      expect(e.workDuration).to.equal(WORK_DURATION);
      expect(e.state).to.equal(State.Created);
      expect(await contract.escrowCount()).to.equal(1);
    });

    it("should auto-increment escrow IDs", async function () {
      const { contract, client, freelancer } = await loadFixture(deployFixture);

      await contract.connect(client).createEscrow(freelancer.address, REVIEW_PERIOD, DISPUTE_PERIOD, WORK_DURATION);
      await contract.connect(client).createEscrow(freelancer.address, REVIEW_PERIOD, DISPUTE_PERIOD, WORK_DURATION);

      expect(await contract.escrowCount()).to.equal(2);
      const e0 = await contract.getEscrow(0);
      const e1 = await contract.getEscrow(1);
      expect(e0.client).to.equal(client.address);
      expect(e1.client).to.equal(client.address);
    });

    it("should revert if freelancer is zero address", async function () {
      const { contract, client } = await loadFixture(deployFixture);
      await expect(
        contract.connect(client).createEscrow(hre.ethers.ZeroAddress, REVIEW_PERIOD, DISPUTE_PERIOD, WORK_DURATION)
      ).to.be.revertedWithCustomError(contract, "ZeroAddress");
    });

    it("should revert if review period is zero", async function () {
      const { contract, client, freelancer } = await loadFixture(deployFixture);
      await expect(
        contract.connect(client).createEscrow(freelancer.address, 0, DISPUTE_PERIOD, WORK_DURATION)
      ).to.be.revertedWithCustomError(contract, "ZeroPeriod");
    });

    it("should revert if dispute period is zero", async function () {
      const { contract, client, freelancer } = await loadFixture(deployFixture);
      await expect(
        contract.connect(client).createEscrow(freelancer.address, REVIEW_PERIOD, 0, WORK_DURATION)
      ).to.be.revertedWithCustomError(contract, "ZeroPeriod");
    });

    it("should revert if work duration is zero", async function () {
      const { contract, client, freelancer } = await loadFixture(deployFixture);
      await expect(
        contract.connect(client).createEscrow(freelancer.address, REVIEW_PERIOD, DISPUTE_PERIOD, 0)
      ).to.be.revertedWithCustomError(contract, "ZeroPeriod");
    });

    it("should revert if client == freelancer", async function () {
      const { contract, client } = await loadFixture(deployFixture);
      await expect(
        contract.connect(client).createEscrow(client.address, REVIEW_PERIOD, DISPUTE_PERIOD, WORK_DURATION)
      ).to.be.revertedWithCustomError(contract, "ClientFreelancerSame");
    });
  });

  // ─── Deposit ───────────────────────────────────

  describe("Deposit", function () {
    it("should deposit, set work deadline, and transition to Funded", async function () {
      const { contract, client, escrowId } = await loadFixture(createdFixture);

      await expect(contract.connect(client).deposit(escrowId, { value: DEPOSIT }))
        .to.emit(contract, "Deposited").withArgs(escrowId, client.address, DEPOSIT);

      const e = await contract.getEscrow(escrowId);
      expect(e.amount).to.equal(DEPOSIT);
      expect(e.state).to.equal(State.Funded);
      expect(e.workDeadline).to.be.greaterThan(0);
    });

    it("should revert if not the client", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(createdFixture);
      await expect(
        contract.connect(freelancer).deposit(escrowId, { value: DEPOSIT })
      ).to.be.revertedWithCustomError(contract, "OnlyClient");
    });

    it("should revert if deposit is zero", async function () {
      const { contract, client, escrowId } = await loadFixture(createdFixture);
      await expect(
        contract.connect(client).deposit(escrowId, { value: 0 })
      ).to.be.revertedWithCustomError(contract, "ZeroDeposit");
    });

    it("should revert if not in Created state", async function () {
      const { contract, client, escrowId } = await loadFixture(fundedFixture);
      await expect(
        contract.connect(client).deposit(escrowId, { value: DEPOSIT })
      ).to.be.revertedWithCustomError(contract, "UnexpectedState");
    });

    it("should revert for non-existent escrow", async function () {
      const { contract, client } = await loadFixture(deployFixture);
      await expect(
        contract.connect(client).deposit(999, { value: DEPOSIT })
      ).to.be.revertedWithCustomError(contract, "EscrowNotFound");
    });
  });

  // ─── Cancel Escrow ─────────────────────────────

  describe("Cancel Escrow", function () {
    it("should refund client after work deadline", async function () {
      const { contract, client, escrowId } = await loadFixture(fundedFixture);
      const balBefore = await hre.ethers.provider.getBalance(client.address);

      await time.increase(WORK_DURATION);

      await expect(contract.connect(client).cancelEscrow(escrowId))
        .to.emit(contract, "EscrowCancelled").withArgs(escrowId, client.address, DEPOSIT);

      const e = await contract.getEscrow(escrowId);
      expect(e.state).to.equal(State.Released);
      expect(e.amount).to.equal(0);

      const balAfter = await hre.ethers.provider.getBalance(client.address);
      expect(balAfter).to.be.greaterThan(balBefore);
    });

    it("should revert before work deadline", async function () {
      const { contract, client, escrowId } = await loadFixture(fundedFixture);
      await expect(
        contract.connect(client).cancelEscrow(escrowId)
      ).to.be.revertedWithCustomError(contract, "WorkDeadlineNotElapsed");
    });

    it("should revert if not the client", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(fundedFixture);
      await time.increase(WORK_DURATION);
      await expect(
        contract.connect(freelancer).cancelEscrow(escrowId)
      ).to.be.revertedWithCustomError(contract, "OnlyClient");
    });

    it("should revert if not in Funded state", async function () {
      const { contract, client, escrowId } = await loadFixture(createdFixture);
      await expect(
        contract.connect(client).cancelEscrow(escrowId)
      ).to.be.revertedWithCustomError(contract, "UnexpectedState");
    });
  });

  // ─── Submit Work ───────────────────────────────

  describe("Submit Work", function () {
    it("should store work link, set timestamp, transition to UnderReview", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(fundedFixture);

      await expect(contract.connect(freelancer).submitWork(escrowId, WORK_LINK))
        .to.emit(contract, "WorkSubmitted").withArgs(escrowId, freelancer.address, WORK_LINK);

      const e = await contract.getEscrow(escrowId);
      expect(e.workLink).to.equal(WORK_LINK);
      expect(e.submissionTimestamp).to.be.greaterThan(0);
      expect(e.state).to.equal(State.UnderReview);
    });

    it("should revert after work deadline", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(fundedFixture);
      await time.increase(WORK_DURATION);
      await expect(
        contract.connect(freelancer).submitWork(escrowId, WORK_LINK)
      ).to.be.revertedWithCustomError(contract, "WorkDeadlineElapsed");
    });

    it("should revert if not the freelancer", async function () {
      const { contract, client, escrowId } = await loadFixture(fundedFixture);
      await expect(
        contract.connect(client).submitWork(escrowId, WORK_LINK)
      ).to.be.revertedWithCustomError(contract, "OnlyFreelancer");
    });

    it("should revert if work link is empty", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(fundedFixture);
      await expect(
        contract.connect(freelancer).submitWork(escrowId, "")
      ).to.be.revertedWithCustomError(contract, "EmptyWorkLink");
    });

    it("should revert if not in Funded state", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(createdFixture);
      await expect(
        contract.connect(freelancer).submitWork(escrowId, WORK_LINK)
      ).to.be.revertedWithCustomError(contract, "UnexpectedState");
    });
  });

  // ─── Approve ───────────────────────────────────

  describe("Approve", function () {
    it("should pay freelancer and transition to Released", async function () {
      const { contract, client, freelancer, escrowId } = await loadFixture(underReviewFixture);
      const balBefore = await hre.ethers.provider.getBalance(freelancer.address);

      await expect(contract.connect(client).approve(escrowId))
        .to.emit(contract, "Approved").withArgs(escrowId, client.address, DEPOSIT);

      const e = await contract.getEscrow(escrowId);
      expect(e.state).to.equal(State.Released);
      expect(e.amount).to.equal(0);

      const balAfter = await hre.ethers.provider.getBalance(freelancer.address);
      expect(balAfter).to.equal(balBefore + DEPOSIT);
    });

    it("should revert if not the client", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(underReviewFixture);
      await expect(
        contract.connect(freelancer).approve(escrowId)
      ).to.be.revertedWithCustomError(contract, "OnlyClient");
    });

    it("should revert if not in UnderReview state", async function () {
      const { contract, client, escrowId } = await loadFixture(fundedFixture);
      await expect(
        contract.connect(client).approve(escrowId)
      ).to.be.revertedWithCustomError(contract, "UnexpectedState");
    });
  });

  // ─── Review Timeout ────────────────────────────

  describe("Claim After Review Timeout", function () {
    it("should auto-release to freelancer", async function () {
      const { contract, freelancer, outsider, escrowId } = await loadFixture(underReviewFixture);
      const balBefore = await hre.ethers.provider.getBalance(freelancer.address);

      await time.increase(REVIEW_PERIOD);

      await expect(contract.connect(outsider).claimAfterReviewTimeout(escrowId))
        .to.emit(contract, "ReviewTimeoutClaimed").withArgs(escrowId, outsider.address, DEPOSIT);

      const balAfter = await hre.ethers.provider.getBalance(freelancer.address);
      expect(balAfter).to.equal(balBefore + DEPOSIT);
    });

    it("should revert before review period elapses", async function () {
      const { contract, client, escrowId } = await loadFixture(underReviewFixture);
      await expect(
        contract.connect(client).claimAfterReviewTimeout(escrowId)
      ).to.be.revertedWithCustomError(contract, "ReviewPeriodNotElapsed");
    });

    it("should revert if not in UnderReview state", async function () {
      const { contract, client, escrowId } = await loadFixture(fundedFixture);
      await expect(
        contract.connect(client).claimAfterReviewTimeout(escrowId)
      ).to.be.revertedWithCustomError(contract, "UnexpectedState");
    });
  });

  // ─── Dispute ───────────────────────────────────

  describe("Dispute", function () {
    it("should raise dispute with reason and transition to Disputed", async function () {
      const { contract, client, escrowId } = await loadFixture(underReviewFixture);

      await expect(contract.connect(client).dispute(escrowId, DISPUTE_REASON))
        .to.emit(contract, "DisputeRaised")
        .withArgs(escrowId, client.address, (v: bigint) => v > 0n, DISPUTE_REASON);

      const e = await contract.getEscrow(escrowId);
      expect(e.state).to.equal(State.Disputed);
      expect(e.disputeReason).to.equal(DISPUTE_REASON);
      expect(e.disputeResponded).to.equal(false);
      expect(e.disputeDeadline).to.be.greaterThan(0);
    });

    it("should revert if reason is empty", async function () {
      const { contract, client, escrowId } = await loadFixture(underReviewFixture);
      await expect(
        contract.connect(client).dispute(escrowId, "")
      ).to.be.revertedWithCustomError(contract, "EmptyWorkLink");
    });

    it("should revert if not the client", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(underReviewFixture);
      await expect(
        contract.connect(freelancer).dispute(escrowId, DISPUTE_REASON)
      ).to.be.revertedWithCustomError(contract, "OnlyClient");
    });

    it("should revert if not in UnderReview state", async function () {
      const { contract, client, escrowId } = await loadFixture(fundedFixture);
      await expect(
        contract.connect(client).dispute(escrowId, DISPUTE_REASON)
      ).to.be.revertedWithCustomError(contract, "UnexpectedState");
    });
  });

  // ─── Submit Dispute Proof ──────────────────────

  describe("Submit Dispute Proof", function () {
    it("should store proof link, set responded, reset deadline", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(disputedFixture);

      await expect(contract.connect(freelancer).submitDisputeProof(escrowId, PROOF_LINK))
        .to.emit(contract, "DisputeProofSubmitted")
        .withArgs(escrowId, freelancer.address, PROOF_LINK);

      const e = await contract.getEscrow(escrowId);
      expect(e.disputeProof).to.equal(PROOF_LINK);
      expect(e.disputeResponded).to.equal(true);
      expect(e.state).to.equal(State.Disputed);
    });

    it("should revert if proof is empty", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(disputedFixture);
      await expect(
        contract.connect(freelancer).submitDisputeProof(escrowId, "")
      ).to.be.revertedWithCustomError(contract, "EmptyWorkLink");
    });

    it("should revert if freelancer already responded", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(disputedFixture);
      await contract.connect(freelancer).submitDisputeProof(escrowId, PROOF_LINK);
      await expect(
        contract.connect(freelancer).submitDisputeProof(escrowId, PROOF_LINK)
      ).to.be.revertedWithCustomError(contract, "FreelancerAlreadyResponded");
    });

    it("should revert if not the freelancer", async function () {
      const { contract, client, escrowId } = await loadFixture(disputedFixture);
      await expect(
        contract.connect(client).submitDisputeProof(escrowId, PROOF_LINK)
      ).to.be.revertedWithCustomError(contract, "OnlyFreelancer");
    });
  });

  // ─── Dispute Resolution ────────────────────────

  describe("Dispute Resolution", function () {
    it("approveAfterDispute: pays freelancer after proof submitted", async function () {
      const { contract, client, freelancer, escrowId } = await loadFixture(disputedFixture);
      await contract.connect(freelancer).submitDisputeProof(escrowId, PROOF_LINK);

      const balBefore = await hre.ethers.provider.getBalance(freelancer.address);
      await expect(contract.connect(client).approveAfterDispute(escrowId))
        .to.emit(contract, "DisputeApproved").withArgs(escrowId, client.address, DEPOSIT);

      const e = await contract.getEscrow(escrowId);
      expect(e.state).to.equal(State.Released);
      const balAfter = await hre.ethers.provider.getBalance(freelancer.address);
      expect(balAfter).to.equal(balBefore + DEPOSIT);
    });

    it("approveAfterDispute: reverts if freelancer has not responded", async function () {
      const { contract, client, escrowId } = await loadFixture(disputedFixture);
      await expect(
        contract.connect(client).approveAfterDispute(escrowId)
      ).to.be.revertedWithCustomError(contract, "DisputeNotResponded");
    });

    it("withdrawDispute: returns to UnderReview and clears dispute fields", async function () {
      const { contract, client, escrowId } = await loadFixture(disputedFixture);

      await expect(contract.connect(client).withdrawDispute(escrowId))
        .to.emit(contract, "DisputeWithdrawn").withArgs(escrowId, client.address);

      const e = await contract.getEscrow(escrowId);
      expect(e.state).to.equal(State.UnderReview);
      expect(e.disputeReason).to.equal("");
      expect(e.disputeProof).to.equal("");
      expect(e.disputeDeadline).to.equal(0);
    });

    it("acceptRefund: freelancer refunds client voluntarily", async function () {
      const { contract, freelancer, client, escrowId } = await loadFixture(disputedFixture);
      const balBefore = await hre.ethers.provider.getBalance(client.address);

      await expect(contract.connect(freelancer).acceptRefund(escrowId))
        .to.emit(contract, "RefundAccepted").withArgs(escrowId, freelancer.address, DEPOSIT);

      const e = await contract.getEscrow(escrowId);
      expect(e.state).to.equal(State.Released);
      const balAfter = await hre.ethers.provider.getBalance(client.address);
      expect(balAfter).to.be.greaterThan(balBefore);
    });

    it("claimAfterDisputeTimeout: refunds client if freelancer never responded", async function () {
      const { contract, outsider, client, escrowId } = await loadFixture(disputedFixture);
      const balBefore = await hre.ethers.provider.getBalance(client.address);

      await time.increase(DISPUTE_PERIOD);

      await expect(contract.connect(outsider).claimAfterDisputeTimeout(escrowId))
        .to.emit(contract, "DisputeTimeoutRefunded").withArgs(escrowId, outsider.address, DEPOSIT);

      const balAfter = await hre.ethers.provider.getBalance(client.address);
      expect(balAfter).to.be.greaterThan(balBefore);
    });

    it("claimAfterDisputeTimeout: pays freelancer if they responded and client was silent", async function () {
      const { contract, freelancer, outsider, escrowId } = await loadFixture(disputedFixture);
      await contract.connect(freelancer).submitDisputeProof(escrowId, PROOF_LINK);

      const balBefore = await hre.ethers.provider.getBalance(freelancer.address);
      await time.increase(DISPUTE_PERIOD);

      await expect(contract.connect(outsider).claimAfterDisputeTimeout(escrowId))
        .to.emit(contract, "DisputeTimeoutReleased").withArgs(escrowId, outsider.address, DEPOSIT);

      const balAfter = await hre.ethers.provider.getBalance(freelancer.address);
      expect(balAfter).to.equal(balBefore + DEPOSIT);
    });

    it("claimAfterDisputeTimeout: reverts before deadline", async function () {
      const { contract, outsider, escrowId } = await loadFixture(disputedFixture);
      await expect(
        contract.connect(outsider).claimAfterDisputeTimeout(escrowId)
      ).to.be.revertedWithCustomError(contract, "DisputePeriodNotElapsed");
    });
  });

  // ─── View Helpers ──────────────────────────────

  describe("View Helpers", function () {
    it("reviewDeadline returns 0 before submission", async function () {
      const { contract, escrowId } = await loadFixture(fundedFixture);
      expect(await contract.reviewDeadline(escrowId)).to.equal(0);
    });

    it("reviewDeadline returns correct value after submission", async function () {
      const { contract, escrowId } = await loadFixture(underReviewFixture);
      const e = await contract.getEscrow(escrowId);
      expect(await contract.reviewDeadline(escrowId)).to.equal(
        e.submissionTimestamp + BigInt(REVIEW_PERIOD)
      );
    });

    it("isReviewTimeoutReached false before, true after", async function () {
      const { contract, escrowId } = await loadFixture(underReviewFixture);
      expect(await contract.isReviewTimeoutReached(escrowId)).to.equal(false);
      await time.increase(REVIEW_PERIOD);
      expect(await contract.isReviewTimeoutReached(escrowId)).to.equal(true);
    });

    it("isDisputeTimeoutReached false before, true after", async function () {
      const { contract, escrowId } = await loadFixture(disputedFixture);
      expect(await contract.isDisputeTimeoutReached(escrowId)).to.equal(false);
      await time.increase(DISPUTE_PERIOD);
      expect(await contract.isDisputeTimeoutReached(escrowId)).to.equal(true);
    });

    it("isWorkDeadlineElapsed false before, true after", async function () {
      const { contract, escrowId } = await loadFixture(fundedFixture);
      expect(await contract.isWorkDeadlineElapsed(escrowId)).to.equal(false);
      await time.increase(WORK_DURATION);
      expect(await contract.isWorkDeadlineElapsed(escrowId)).to.equal(true);
    });

    it("isWorkDeadlineElapsed false if not in Funded state", async function () {
      const { contract, escrowId } = await loadFixture(underReviewFixture);
      expect(await contract.isWorkDeadlineElapsed(escrowId)).to.equal(false);
    });

    it("getEscrow reverts for non-existent ID", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(contract.getEscrow(999)).to.be.revertedWithCustomError(contract, "EscrowNotFound");
    });
  });
});
