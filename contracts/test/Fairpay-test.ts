import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";

describe("FairPayEscrow", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.

  async function deployFairPayEscrowFixture() {

    const [client, freelancer] = await hre.ethers.getSigners();

    const reviewPeriod = 7 * 24 * 60 * 60; // 7 days
    const disputePeriod = 3 * 24 * 60 * 60; // 3 days
    const depositAmount = hre.ethers.parseEther("1.0");
    const workHash = hre.ethers.hashMessage(
      "0x5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
    );

    const FairPayEscrow = await hre.ethers.getContractFactory("FairPayEscrow");
    const fairPayEscrow = await FairPayEscrow.deploy(freelancer.address, reviewPeriod, disputePeriod);

    return { fairPayEscrow, client, freelancer, reviewPeriod, disputePeriod, depositAmount, workHash };
  }

  describe("Deployment", function () {
    it("Should set the right client and freelancer", async function () {
      const { fairPayEscrow, client, freelancer } = await loadFixture(deployFairPayEscrowFixture);

      expect(await fairPayEscrow.client()).to.equal(client.address);
      expect(await fairPayEscrow.freelancer()).to.equal(freelancer.address);
    });

    it("Should set the right review and dispute periods", async function () {
      const { fairPayEscrow, reviewPeriod, disputePeriod } = await loadFixture(deployFairPayEscrowFixture);

      expect(await fairPayEscrow.reviewPeriod()).to.equal(reviewPeriod);
      expect(await fairPayEscrow.disputePeriod()).to.equal(disputePeriod);
    });

    it("Should set the initial state to Created", async function () {
      const { fairPayEscrow } = await loadFixture(deployFairPayEscrowFixture);

      expect(await fairPayEscrow.state()).to.equal(0); // Created = 0
    });
  });

  describe("Deposit", function () {
    it("Should revert if the sender is not the client", async function () {
      const { fairPayEscrow, freelancer } = await loadFixture(deployFairPayEscrowFixture);

      await expect(fairPayEscrow.connect(freelancer).deposit()).to.be.revertedWith("FairPay: caller is not the client");
    });

    it("Should revert if the deposit is zero", async function () {
      const { fairPayEscrow, client } = await loadFixture(deployFairPayEscrowFixture);

      await expect(fairPayEscrow.connect(client).deposit()).to.be.revertedWith("FairPay: deposit must be > 0");
    });

    it("Should set the amount and state to Funded", async function () {
      const { fairPayEscrow, client, depositAmount } = await loadFixture(deployFairPayEscrowFixture);

      await expect(fairPayEscrow.connect(client).deposit({ value: depositAmount }))
        .to.emit(fairPayEscrow, "Deposited")
        .withArgs(client.address, depositAmount);

      expect(await fairPayEscrow.amount()).to.equal(depositAmount);
      expect(await fairPayEscrow.state()).to.equal(1); // Funded = 1
    });
  });

  describe("Submit Work", function () {
    it("Should revert if the sender is not the freelancer", async function () {
      const { fairPayEscrow, client, workHash } = await loadFixture(deployFairPayEscrowFixture);

      await expect(fairPayEscrow.connect(client).submitWork(workHash)).to.be.revertedWith("FairPay: caller is not the freelancer");
    });

    it("Should revert if the work hash is empty", async function () {
      const { fairPayEscrow, client, freelancer, depositAmount } = await loadFixture(deployFairPayEscrowFixture);

      // Must deposit first so the contract is in Funded state
      await fairPayEscrow.connect(client).deposit({ value: depositAmount });

      // ZeroHash is the actual bytes32(0) that the contract checks against
      await expect(fairPayEscrow.connect(freelancer).submitWork(hre.ethers.ZeroHash))
        .to.be.revertedWith("FairPay: empty work hash");
    });

    it("Should set the work hash, submission timestamp and state to UnderReview", async function () {
      const { fairPayEscrow, client, freelancer, depositAmount, workHash } = await loadFixture(deployFairPayEscrowFixture);

      // Must deposit first so the contract is in Funded state
      await fairPayEscrow.connect(client).deposit({ value: depositAmount });

      await expect(fairPayEscrow.connect(freelancer).submitWork(workHash))
        .to.emit(fairPayEscrow, "WorkSubmitted")
        .withArgs(freelancer.address, workHash, anyValue);

      expect(await fairPayEscrow.workHash()).to.equal(workHash);
      expect(await fairPayEscrow.state()).to.equal(2); // UnderReview = 2
    });
  });

  describe("Approve", function () {
    it("Should revert if the sender is not the client", async function () {
      const { fairPayEscrow, freelancer } = await loadFixture(deployFairPayEscrowFixture);

      await expect(fairPayEscrow.connect(freelancer).approve()).to.be.revertedWith("FairPay: caller is not the client");
    });

    it("Should revert if the state is not UnderReview", async function () {
      const { fairPayEscrow, client } = await loadFixture(deployFairPayEscrowFixture);

      // Contract is in Created state — inState(UnderReview) fires a custom error
      await expect(fairPayEscrow.connect(client).approve())
        .to.be.revertedWithCustomError(fairPayEscrow, "UnexpectedState");
    });

    it("Should release the funds to the freelancer and set the state to Released", async function () {
      const { fairPayEscrow, client, freelancer, depositAmount, workHash } = await loadFixture(deployFairPayEscrowFixture);

      await fairPayEscrow.connect(client).deposit({ value: depositAmount });
      await fairPayEscrow.connect(freelancer).submitWork(workHash);

      await expect(fairPayEscrow.connect(client).approve())
        .to.emit(fairPayEscrow, "Approved")
        .withArgs(client.address, depositAmount);

      expect(await fairPayEscrow.state()).to.equal(4); // Released = 4
    });
  });

  describe("Claim After Review Timeout", function () {
    it("Should revert if the review period has not elapsed", async function () {
      const { fairPayEscrow, client, freelancer, depositAmount, workHash } = await loadFixture(deployFairPayEscrowFixture);

      await fairPayEscrow.connect(client).deposit({ value: depositAmount });
      await fairPayEscrow.connect(freelancer).submitWork(workHash);

      await expect(fairPayEscrow.connect(client).claimAfterReviewTimeout())
        .to.be.revertedWith("FairPay: review period has not elapsed");
    });

    it("Should release the funds to the freelancer and set the state to Released", async function () {
      const { fairPayEscrow, client, freelancer, depositAmount, workHash, reviewPeriod } = await loadFixture(deployFairPayEscrowFixture);

      await fairPayEscrow.connect(client).deposit({ value: depositAmount });
      await fairPayEscrow.connect(freelancer).submitWork(workHash);

      // mine blocks until review period elapses
      await hre.ethers.provider.send("evm_increaseTime", [reviewPeriod + 1]);
      await hre.ethers.provider.send("evm_mine", []);

      await expect(fairPayEscrow.connect(client).claimAfterReviewTimeout())
        .to.emit(fairPayEscrow, "ReviewTimeoutClaimed")
        .withArgs(client.address, depositAmount);

      expect(await fairPayEscrow.state()).to.equal(4); // Released = 4
    });
  });

  describe("Dispute", function () {
    it("Should revert if the sender is not the client", async function () {
      const { fairPayEscrow, freelancer } = await loadFixture(deployFairPayEscrowFixture);

      await expect(fairPayEscrow.connect(freelancer).dispute()).to.be.revertedWith("FairPay: caller is not the client");
    });

    it("Should revert if the state is not UnderReview", async function () {
      const { fairPayEscrow, client } = await loadFixture(deployFairPayEscrowFixture);

      // Contract is in Created state — inState(UnderReview) fires a custom error
      await expect(fairPayEscrow.connect(client).dispute())
        .to.be.revertedWithCustomError(fairPayEscrow, "UnexpectedState");
    });

    it("Should set the dispute deadline and state to Disputed", async function () {
      const { fairPayEscrow, client, freelancer, depositAmount, workHash } = await loadFixture(deployFairPayEscrowFixture);

      await fairPayEscrow.connect(client).deposit({ value: depositAmount });
      await fairPayEscrow.connect(freelancer).submitWork(workHash);

      await expect(fairPayEscrow.connect(client).dispute())
        .to.emit(fairPayEscrow, "DisputeRaised")
        .withArgs(client.address, anyValue);

      expect(await fairPayEscrow.state()).to.equal(3); // Disputed = 3
    });
  });

  describe("Withdraw Dispute", function () {
    it("Should revert if the sender is not the client", async function () {
      const { fairPayEscrow, freelancer } = await loadFixture(deployFairPayEscrowFixture);

      await expect(fairPayEscrow.connect(freelancer).withdrawDispute()).to.be.revertedWith("FairPay: caller is not the client");
    });

    it("Should revert if the state is not Disputed", async function () {
      const { fairPayEscrow, client } = await loadFixture(deployFairPayEscrowFixture);

      // Contract is in Created state — inState(Disputed) fires a custom error
      await expect(fairPayEscrow.connect(client).withdrawDispute())
        .to.be.revertedWithCustomError(fairPayEscrow, "UnexpectedState");
    });

    it("Should reset the dispute deadline and set the state to UnderReview", async function () {
      const { fairPayEscrow, client, freelancer, depositAmount, workHash } = await loadFixture(deployFairPayEscrowFixture);

      await fairPayEscrow.connect(client).deposit({ value: depositAmount });
      await fairPayEscrow.connect(freelancer).submitWork(workHash);
      await fairPayEscrow.connect(client).dispute();

      await expect(fairPayEscrow.connect(client).withdrawDispute())
        .to.emit(fairPayEscrow, "DisputeWithdrawn")
        .withArgs(client.address);

      expect(await fairPayEscrow.state()).to.equal(2); // UnderReview = 2
    });
  });

  describe("Accept Refund", function () {
    it("Should revert if the sender is not the freelancer", async function () {
      const { fairPayEscrow, client } = await loadFixture(deployFairPayEscrowFixture);

      await expect(fairPayEscrow.connect(client).acceptRefund()).to.be.revertedWith("FairPay: caller is not the freelancer");
    });

    it("Should revert if the state is not Disputed", async function () {
      const { fairPayEscrow, freelancer } = await loadFixture(deployFairPayEscrowFixture);

      // Contract is in Created state — inState(Disputed) fires a custom error
      await expect(fairPayEscrow.connect(freelancer).acceptRefund())
        .to.be.revertedWithCustomError(fairPayEscrow, "UnexpectedState");
    });

    it("Should refund the client and set the state to Released", async function () {
      const { fairPayEscrow, client, freelancer, depositAmount, workHash } = await loadFixture(deployFairPayEscrowFixture);

      await fairPayEscrow.connect(client).deposit({ value: depositAmount });
      await fairPayEscrow.connect(freelancer).submitWork(workHash);
      await fairPayEscrow.connect(client).dispute();

      await expect(fairPayEscrow.connect(freelancer).acceptRefund())
        .to.emit(fairPayEscrow, "RefundAccepted")
        .withArgs(freelancer.address, depositAmount);

      expect(await fairPayEscrow.state()).to.equal(4); // Released = 4
    });
  });
});
