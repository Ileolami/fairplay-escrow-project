# FairPayEscrow Contract

This is a smart contract for escrow functionality. It allows a client to deposit funds into an escrow, including the funds and a freelancer to submit work. The client can approve the work, or raise a dispute. The freelancer can respond to a dispute. The escrow can be cancelled by the client if the freelancer does not submit work within the work duration. The funds can be released to the freelancer if the client does not respond to a dispute within the dispute period. The funds can be released to the client if the freelancer does not respond to a dispute within the dispute period.

This ensures a fair payment system for freelancers and clients as compare to the traditional payment system where freelancers are usually scammed/ghosted by clients.

In a real case, let's say:

Alice hires Bob to build a website for 1 ETH

*Step 1 — Create & Fund.*
Alice calls `createEscrow()` with Bob's address and sets the timers: 14 days for Bob to work, 7 days for Alice to review, and 3 days for dispute responses. She then calls `deposit()` and sends 1 ETH. The money is now locked in the contract and Bob's 14-day work clock starts.

*Step 2 — Submit Work.*
Bob finishes the website and calls `submitWork()` with a hash of his deliverable. This moves the escrow into "Under Review" and starts Alice's 7-day review window.

*Step 3 — Review.*
Alice now has three options.
  i. She can call `approve()` to pay Bob immediately.
  ii. She can raise a `dispute()` if she's unhappy.
  ii. Or she can do nothing — if 7 days pass with no action, Bob can call `claimAfterReviewTimeout()` and get paid automatically.

*Step 4 — Dispute (if raised).*
If Alice disputes, Bob gets 3 days to respond. He can call  `submitDisputeProof()` with a hash proving his work was done properly. This resets the 3-day timer so Alice has time to review his proof. Now Alice can `approveAfterDispute()` to pay Bob or `withdrawDispute()` to go back to review, or stay silent — and since Bob defended himself, he auto-wins after the timer runs out. Alternatively, if Bob knows his work was bad, he can call `acceptRefund()` and the money goes back to Alice. If Bob never responds at all, Alice gets an automatic refund after the deadline.

## Dependencies

This project uses the following dependencies:

- [Hardhat](https://hardhat.org/)
- [Hardhat Ignition](https://hardhat.org/ignition/)
- [Hardhat Toolbox](https://hardhat.org/toolbox/)
- [OpenZeppelin Contracts](https://openzeppelin.com/contracts/)
- [Typechain](https://github.com/dethcrypto/TypeChain)
- [Ethers](https://github.com/ethers-io/ethers.js)
- [Chai](https://github.com/chaijs/chai)
- [Mocha](https://mochajs.org/)
- [Node](https://nodejs.org/en/)
- [PNPM](https://pnpm.io/)

## Project Setup

To run this project, you need to have [Node.js](https://nodejs.org/en/) and [PNPM](https://pnpm.io/) installed on your computer. Then, run the following commands:

```bash
pnpm install
```

## Running the Tests

To run the tests, run the following command:

```bash
npx hardhat test
```

## Contract Address

The contract is deployed on the RSK Testnet at the following address:

`0xc9e098e62c14c8dc015f238c226ea581fa5c4425`

Explorer: [https://explorer.testnet.rootstock.io/address/0xc9e098e62c14c8dc015f238c226ea581fa5c4425](https://explorer.testnet.rootstock.io/address/0xc9e098e62c14c8dc015f238c226ea581fa5c4425)

## Project Structure

The project is structured as follows:

```bash
contracts/
├── contracts/ — Solidity contracts
│   ├── FairPayEscrow.sol — main escrow logic
│   ├── FairPayTypes.sol — shared types & errors
├── test/ — Mocha tests
│   ├── FairPay-core.test.ts — core escrow logic
│   └── FairPay-dispute.test.ts — dispute resolution
├── ignition/ — Hardhat Ignition modules
│   └── modules/
│       └── FairPayEscrow.ts — deploys FairPayEscrow
└── hardhat.config.ts — Hardhat config
```
