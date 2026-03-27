import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";

describe("FairPayEscrow — Disputes & Edge Cases", function () {
  const REVIEW_PERIOD = 7 * 24 * 60 * 60;
  const DISPUTE_PERIOD = 3 * 24 * 60 * 60;
  const WORK_DURATION = 14 * 24 * 60 * 60;
  const DEPOSIT = hre.ethers.parseEther("1.0");
  const WORK_LINK      = "https://github.com/user/deliverable";
  const DISPUTE_REASON = "Work does not meet requirements";
  const PROOF_LINK     = "https://proof.example.com/v1";

  const State = { Created: 0, Funded: 1, UnderReview: 2, Disputed: 3, Released: 4 };

  // ─── Fixtures ──────────────────────────────────

  async function baseFixture() {
    const [client, freelancer, outsider] = await hre.ethers.getSigners();
    const Factory = await hre.ethers.getContractFactory("FairPayEscrow");
    const contract = await Factory.deploy();
    await contract.connect(client).createEscrow(
      freelancer.address, REVIEW_PERIOD, DISPUTE_PERIOD, WORK_DURATION
    );
    return { contract, client, freelancer, outsider, escrowId: 0 };
  }

  async function underReviewFixture() {
    const base = await baseFixture();
    await base.contract.connect(base.client).deposit(base.escrowId, { value: DEPOSIT });
    await base.contract.connect(base.freelancer).submitWork(base.escrowId, WORK_LINK);
    return base;
  }

  async function disputedFixture() {
    const base = await underReviewFixture();
    await base.contract.connect(base.client).dispute(base.escrowId, DISPUTE_REASON);
    return base;
  }

  async function disputeRespondedFixture() {
    const base = await disputedFixture();
    await base.contract.connect(base.freelancer).submitDisputeProof(base.escrowId, PROOF_LINK);
    return base;
  }

  // ─── Dispute ───────────────────────────────────

  describe("Dispute", function () {
    it("should transition to Disputed and set deadline", async function () {
      const { contract, client, escrowId } = await loadFixture(underReviewFixture);

      await expect(contract.connect(client).dispute(escrowId, DISPUTE_REASON))
        .to.emit(contract, "DisputeRaised").withArgs(escrowId, client.address, anyValue, DISPUTE_REASON);

      const e = await contract.getEscrow(escrowId);
      expect(e.state).to.equal(State.Disputed);
      expect(e.disputeDeadline).to.be.greaterThan(0);
      expect(e.disputeResponded).to.equal(false);
    });

    it("should revert if not the client", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(underReviewFixture);
      await expect(
        contract.connect(freelancer).dispute(escrowId, DISPUTE_REASON)
      ).to.be.revertedWithCustomError(contract, "OnlyClient");
    });

    it("should revert if not in UnderReview state", async function () {
      const { contract, client, escrowId } = await loadFixture(baseFixture);
      await expect(
        contract.connect(client).dispute(escrowId, DISPUTE_REASON)
      ).to.be.revertedWithCustomError(contract, "UnexpectedState");
    });
  });

  // ─── Submit Dispute Proof ──────────────────────

  describe("Submit Dispute Proof", function () {
    it("should mark response and reset deadline", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(disputedFixture);

      const eBefore = await contract.getEscrow(escrowId);

      await expect(contract.connect(freelancer).submitDisputeProof(escrowId, PROOF_LINK))
        .to.emit(contract, "DisputeProofSubmitted")
        .withArgs(escrowId, freelancer.address, PROOF_LINK);

      const e = await contract.getEscrow(escrowId);
      expect(e.disputeResponded).to.equal(true);
      expect(e.disputeProof).to.equal(PROOF_LINK);
      expect(e.state).to.equal(State.Disputed);
    });

    it("should revert if not the freelancer", async function () {
      const { contract, client, escrowId } = await loadFixture(disputedFixture);
      await expect(
        contract.connect(client).submitDisputeProof(escrowId, PROOF_LINK)
      ).to.be.revertedWithCustomError(contract, "OnlyFreelancer");
    });

    it("should revert if proof is empty", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(disputedFixture);
      await expect(
        contract.connect(freelancer).submitDisputeProof(escrowId, "")
      ).to.be.revertedWithCustomError(contract, "EmptyWorkLink");
    });

    it("should revert if already responded", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(disputeRespondedFixture);
      await expect(
        contract.connect(freelancer).submitDisputeProof(escrowId, "https://proof.example.com/v2")
      ).to.be.revertedWithCustomError(contract, "FreelancerAlreadyResponded");
    });

    it("should revert if not in Disputed state", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(underReviewFixture);
      await expect(
        contract.connect(freelancer).submitDisputeProof(escrowId, PROOF_LINK)
      ).to.be.revertedWithCustomError(contract, "UnexpectedState");
    });
  });

  // ─── Approve After Dispute ─────────────────────

  describe("Approve After Dispute", function () {
    it("should pay freelancer after proof is reviewed", async function () {
      const { contract, client, freelancer, escrowId } = await loadFixture(disputeRespondedFixture);
      const balBefore = await hre.ethers.provider.getBalance(freelancer.address);

      await expect(contract.connect(client).approveAfterDispute(escrowId))
        .to.emit(contract, "DisputeApproved").withArgs(escrowId, client.address, DEPOSIT);

      const e = await contract.getEscrow(escrowId);
      expect(e.state).to.equal(State.Released);

      const balAfter = await hre.ethers.provider.getBalance(freelancer.address);
      expect(balAfter).to.equal(balBefore + DEPOSIT);
    });

    it("should revert if freelancer has not responded", async function () {
      const { contract, client, escrowId } = await loadFixture(disputedFixture);
      await expect(
        contract.connect(client).approveAfterDispute(escrowId)
      ).to.be.revertedWithCustomError(contract, "DisputeNotResponded");
    });

    it("should revert if not the client", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(disputeRespondedFixture);
      await expect(
        contract.connect(freelancer).approveAfterDispute(escrowId)
      ).to.be.revertedWithCustomError(contract, "OnlyClient");
    });
  });

  // ─── Withdraw Dispute ──────────────────────────

  describe("Withdraw Dispute", function () {
    it("should return to UnderReview and reset dispute state", async function () {
      const { contract, client, escrowId } = await loadFixture(disputedFixture);

      await expect(contract.connect(client).withdrawDispute(escrowId))
        .to.emit(contract, "DisputeWithdrawn").withArgs(escrowId, client.address);

      const e = await contract.getEscrow(escrowId);
      expect(e.state).to.equal(State.UnderReview);
      expect(e.disputeDeadline).to.equal(0);
      expect(e.disputeResponded).to.equal(false);
    });

    it("should work even after freelancer responded", async function () {
      const { contract, client, escrowId } = await loadFixture(disputeRespondedFixture);
      await contract.connect(client).withdrawDispute(escrowId);
      const e = await contract.getEscrow(escrowId);
      expect(e.state).to.equal(State.UnderReview);
      expect(e.disputeResponded).to.equal(false);
    });

    it("should revert if not the client", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(disputedFixture);
      await expect(
        contract.connect(freelancer).withdrawDispute(escrowId)
      ).to.be.revertedWithCustomError(contract, "OnlyClient");
    });
  });

  // ─── Accept Refund ─────────────────────────────

  describe("Accept Refund", function () {
    it("should refund client voluntarily", async function () {
      const { contract, client, freelancer, escrowId } = await loadFixture(disputedFixture);
      const balBefore = await hre.ethers.provider.getBalance(client.address);

      await expect(contract.connect(freelancer).acceptRefund(escrowId))
        .to.emit(contract, "RefundAccepted").withArgs(escrowId, freelancer.address, DEPOSIT);

      const balAfter = await hre.ethers.provider.getBalance(client.address);
      expect(balAfter).to.equal(balBefore + DEPOSIT);
    });

    it("should revert if not the freelancer", async function () {
      const { contract, client, escrowId } = await loadFixture(disputedFixture);
      await expect(
        contract.connect(client).acceptRefund(escrowId)
      ).to.be.revertedWithCustomError(contract, "OnlyFreelancer");
    });
  });

  // ─── Dispute Timeout ───────────────────────────

  describe("Claim After Dispute Timeout", function () {
    it("should refund client if freelancer did NOT respond", async function () {
      const { contract, client, outsider, escrowId } = await loadFixture(disputedFixture);
      const balBefore = await hre.ethers.provider.getBalance(client.address);

      await time.increase(DISPUTE_PERIOD);

      await expect(contract.connect(outsider).claimAfterDisputeTimeout(escrowId))
        .to.emit(contract, "DisputeTimeoutRefunded").withArgs(escrowId, outsider.address, DEPOSIT);

      const balAfter = await hre.ethers.provider.getBalance(client.address);
      expect(balAfter).to.equal(balBefore + DEPOSIT);
    });

    it("should pay freelancer if they responded and client was silent", async function () {
      const { contract, freelancer, outsider, escrowId } = await loadFixture(disputeRespondedFixture);
      const balBefore = await hre.ethers.provider.getBalance(freelancer.address);

      await time.increase(DISPUTE_PERIOD);

      await expect(contract.connect(outsider).claimAfterDisputeTimeout(escrowId))
        .to.emit(contract, "DisputeTimeoutReleased").withArgs(escrowId, outsider.address, DEPOSIT);

      const balAfter = await hre.ethers.provider.getBalance(freelancer.address);
      expect(balAfter).to.equal(balBefore + DEPOSIT);
    });

    it("should revert before deadline", async function () {
      const { contract, client, escrowId } = await loadFixture(disputedFixture);
      await expect(
        contract.connect(client).claimAfterDisputeTimeout(escrowId)
      ).to.be.revertedWithCustomError(contract, "DisputePeriodNotElapsed");
    });

    it("isDisputeTimeoutReached false before, true after", async function () {
      const { contract, escrowId } = await loadFixture(disputedFixture);
      expect(await contract.isDisputeTimeoutReached(escrowId)).to.equal(false);
      await time.increase(DISPUTE_PERIOD);
      expect(await contract.isDisputeTimeoutReached(escrowId)).to.equal(true);
    });
  });

  // ─── Edge Cases ────────────────────────────────

  describe("Edge Cases", function () {
    it("dispute → withdraw → re-dispute works cleanly", async function () {
      const { contract, client, freelancer, escrowId } = await loadFixture(underReviewFixture);

      await contract.connect(client).dispute(escrowId, DISPUTE_REASON);
      await contract.connect(freelancer).submitDisputeProof(escrowId, PROOF_LINK);
      await contract.connect(client).withdrawDispute(escrowId);

      // Re-dispute — fresh state
      await contract.connect(client).dispute(escrowId, DISPUTE_REASON);
      const e = await contract.getEscrow(escrowId);
      expect(e.disputeResponded).to.equal(false);
      expect(e.disputeProof).to.equal("");

      // Freelancer can respond again
      await contract.connect(freelancer).submitDisputeProof(escrowId, "https://proof.example.com/v2");
      const e2 = await contract.getEscrow(escrowId);
      expect(e2.disputeResponded).to.equal(true);
      expect(e2.disputeProof).to.equal("https://proof.example.com/v2");
    });

    it("dispute deadline resets when freelancer submits proof", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(disputedFixture);
      const e1 = await contract.getEscrow(escrowId);

      await time.increase(2 * 24 * 60 * 60); // 2 days into 3-day window

      await contract.connect(freelancer).submitDisputeProof(escrowId, PROOF_LINK);
      const e2 = await contract.getEscrow(escrowId);
      expect(e2.disputeDeadline).to.be.greaterThan(e1.disputeDeadline);
    });

    it("freelancer submits just before work deadline — still valid", async function () {
      const { contract, client, freelancer, escrowId } = await loadFixture(baseFixture);
      await contract.connect(client).deposit(escrowId, { value: DEPOSIT });
      await time.increase(WORK_DURATION - 2);
      await expect(contract.connect(freelancer).submitWork(escrowId, WORK_LINK))
        .to.emit(contract, "WorkSubmitted");
    });

    it("multiple independent escrows work correctly", async function () {
      const { contract, client, freelancer, outsider } = await loadFixture(baseFixture);

      // Escrow 0 already created in baseFixture
      await contract.connect(client).deposit(0, { value: DEPOSIT });

      // Create escrow 1
      await contract.connect(freelancer).createEscrow(
        client.address, REVIEW_PERIOD, DISPUTE_PERIOD, WORK_DURATION
      );
      await contract.connect(freelancer).deposit(1, { value: hre.ethers.parseEther("2.0") });

      const e0 = await contract.getEscrow(0);
      const e1 = await contract.getEscrow(1);
      expect(e0.client).to.equal(client.address);
      expect(e1.client).to.equal(freelancer.address);
      expect(e0.amount).to.equal(DEPOSIT);
      expect(e1.amount).to.equal(hre.ethers.parseEther("2.0"));
    });

    it("contract balance tracks all escrows correctly", async function () {
      const { contract, client, freelancer } = await loadFixture(baseFixture);
      const addr = await contract.getAddress();

      await contract.connect(client).deposit(0, { value: DEPOSIT });
      expect(await hre.ethers.provider.getBalance(addr)).to.equal(DEPOSIT);

      // Create + fund a second escrow
      await contract.connect(freelancer).createEscrow(
        client.address, REVIEW_PERIOD, DISPUTE_PERIOD, WORK_DURATION
      );
      const dep2 = hre.ethers.parseEther("0.5");
      await contract.connect(freelancer).deposit(1, { value: dep2 });
      expect(await hre.ethers.provider.getBalance(addr)).to.equal(DEPOSIT + dep2);

      // Release escrow 0
      await contract.connect(freelancer).submitWork(0, WORK_LINK);
      await contract.connect(client).approve(0);
      expect(await hre.ethers.provider.getBalance(addr)).to.equal(dep2);
    });

    it("all functions revert after Released state", async function () {
      const { contract, client, freelancer, escrowId } = await loadFixture(underReviewFixture);
      await contract.connect(client).approve(escrowId);

      await expect(contract.connect(client).deposit(escrowId, { value: DEPOSIT }))
        .to.be.revertedWithCustomError(contract, "UnexpectedState");
      await expect(contract.connect(client).cancelEscrow(escrowId))
        .to.be.revertedWithCustomError(contract, "UnexpectedState");
      await expect(contract.connect(freelancer).submitWork(escrowId, WORK_LINK))
        .to.be.revertedWithCustomError(contract, "UnexpectedState");
      await expect(contract.connect(client).approve(escrowId))
        .to.be.revertedWithCustomError(contract, "UnexpectedState");
      await expect(contract.connect(client).dispute(escrowId, DISPUTE_REASON))
        .to.be.revertedWithCustomError(contract, "UnexpectedState");
      await expect(contract.connect(freelancer).acceptRefund(escrowId))
        .to.be.revertedWithCustomError(contract, "UnexpectedState");
    });

    it("full happy path: create → deposit → submit → approve", async function () {
      const { contract, client, freelancer } = await loadFixture(baseFixture);
      await contract.connect(client).deposit(0, { value: DEPOSIT });
      await contract.connect(freelancer).submitWork(0, WORK_LINK);
      await contract.connect(client).approve(0);
      expect((await contract.getEscrow(0)).state).to.equal(State.Released);
    });

    it("full dispute defended path", async function () {
      const { contract, client, freelancer, outsider } = await loadFixture(baseFixture);
      await contract.connect(client).deposit(0, { value: DEPOSIT });
      await contract.connect(freelancer).submitWork(0, WORK_LINK);
      await contract.connect(client).dispute(0, DISPUTE_REASON);
      await contract.connect(freelancer).submitDisputeProof(0, PROOF_LINK);
      await time.increase(DISPUTE_PERIOD);
      await contract.connect(outsider).claimAfterDisputeTimeout(0);
      expect((await contract.getEscrow(0)).state).to.equal(State.Released);
    });

    it("full cancel path: create → deposit → deadline → cancel", async function () {
      const { contract, client } = await loadFixture(baseFixture);
      await contract.connect(client).deposit(0, { value: DEPOSIT });
      await time.increase(WORK_DURATION);
      await contract.connect(client).cancelEscrow(0);
      expect((await contract.getEscrow(0)).state).to.equal(State.Released);
    });
  });
});
