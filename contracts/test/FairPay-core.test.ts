import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";

describe("FairPayEscrow — Core", function () {
  const REVIEW_PERIOD = 7 * 24 * 60 * 60;
  const DISPUTE_PERIOD = 3 * 24 * 60 * 60;
  const WORK_DURATION = 14 * 24 * 60 * 60;
  const DEPOSIT = hre.ethers.parseEther("1.0");
  const WORK_HASH = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("deliverable-v1"));

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
    const tx = await base.contract.connect(base.client).createEscrow(
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
    await base.contract.connect(base.freelancer).submitWork(base.escrowId, WORK_HASH);
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
    it("should store hash, set timestamp, transition to UnderReview", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(fundedFixture);

      await expect(contract.connect(freelancer).submitWork(escrowId, WORK_HASH))
        .to.emit(contract, "WorkSubmitted").withArgs(escrowId, freelancer.address, WORK_HASH);

      const e = await contract.getEscrow(escrowId);
      expect(e.workHash).to.equal(WORK_HASH);
      expect(e.submissionTimestamp).to.be.greaterThan(0);
      expect(e.state).to.equal(State.UnderReview);
    });

    it("should revert after work deadline", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(fundedFixture);
      await time.increase(WORK_DURATION);
      await expect(
        contract.connect(freelancer).submitWork(escrowId, WORK_HASH)
      ).to.be.revertedWithCustomError(contract, "WorkDeadlineElapsed");
    });

    it("should revert if not the freelancer", async function () {
      const { contract, client, escrowId } = await loadFixture(fundedFixture);
      await expect(
        contract.connect(client).submitWork(escrowId, WORK_HASH)
      ).to.be.revertedWithCustomError(contract, "OnlyFreelancer");
    });

    it("should revert if hash is empty", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(fundedFixture);
      await expect(
        contract.connect(freelancer).submitWork(escrowId, hre.ethers.ZeroHash)
      ).to.be.revertedWithCustomError(contract, "EmptyWorkHash");
    });

    it("should revert if not in Funded state", async function () {
      const { contract, freelancer, escrowId } = await loadFixture(createdFixture);
      await expect(
        contract.connect(freelancer).submitWork(escrowId, WORK_HASH)
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
