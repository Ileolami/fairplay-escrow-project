# FairPlay Escrow

A decentralized escrow protocol for freelancers and clients, deployed on [Rootstock (RSK) Testnet](https://rootstock.io). FairPlay protects both parties through time-based automatic resolutions — neither side can ghost the other.

**Live Contract:** [`0xc9E098e62c14C8DC015f238c226ea581Fa5C4425`](https://explorer.testnet.rootstock.io/address/0xc9e098e62c14c8dc015f238c226ea581fa5c4425) on RSK Testnet

**Live Frontend:** [https://fairplay-escrow-project.vercel.app/](https://fairplay-escrow-project.vercel.app/)

---

## How It Works

A single deployed contract manages all escrows via a mapping. Each escrow follows a five-state lifecycle:

```bash
Created → Funded → UnderReview → Disputed → Released
```

Three symmetric rules guarantee a fair outcome regardless of who stays silent:

| Situation | Outcome |
|---|---|
| Client does not review work within the review period | Freelancer is automatically paid |
| Freelancer does not respond to a dispute within the dispute period | Client is automatically refunded |
| Freelancer responds to dispute, client then stays silent | Freelancer is automatically paid |

### Full Flow

1. **Client** calls `createEscrow()` — sets the freelancer address, work deadline, review period, and dispute period
2. **Client** calls `deposit()` — funds the escrow with tRBTC; the work deadline clock starts
3. **Freelancer** calls `submitWork()` — submits a URL or description of their deliverable before the work deadline
4. **Client** reviews the work and either:
   - Calls `approve()` — pays the freelancer immediately
   - Raises no dispute — freelancer claims payment after the review period via `claimAfterReviewTimeout()`
   - Calls `dispute(reason)` — opens a dispute with a written reason
5. **If disputed:**
   - **Freelancer** calls `submitDisputeProof(proofLink)` — responds with evidence
   - **Client** can `approveAfterDispute()` to pay, or `withdrawDispute()` to drop it
   - **Either** can wait — after the dispute period, `claimAfterDisputeTimeout()` pays the freelancer if they responded, or refunds the client if they did not
   - **Freelancer** can also call `acceptRefund()` at any time to voluntarily return the funds

---

## Project Structure

```bash
fairplay-escrow-project/
├── contracts/                    # Hardhat smart contract project
│   ├── contracts/
│   │   ├── FairPayEscrow.sol     # Main escrow contract
│   │   └── FairPayTypes.sol      # Shared types, structs & custom errors
│   ├── test/
│   │   ├── FairPay-core.test.ts  # Core logic tests (49 tests)
│   │   └── FairPay-dispute.test.ts # Dispute & edge case tests
│   ├── ignition/
│   │   └── modules/
│   │       └── FairPayEscrow.ts  # Hardhat Ignition deployment module
│   └── hardhat.config.ts
│
└── frontend/                     # Next.js frontend
    └── src/
        ├── app/
        │   ├── page.tsx          # Main dashboard (My Escrows / All Escrows / Create)
        │   ├── layout.tsx
        │   └── providers.tsx     # Thirdweb + Wagmi providers + WagmiBridge
        ├── components/
        │   ├── Header.tsx        # Sticky header with wallet connect button
        │   ├── CreateEscrow.tsx  # Escrow creation form
        │   ├── EscrowList.tsx    # Paginated list with role filtering
        │   └── EscrowCard.tsx    # Expandable card with all escrow actions
        └── lib/
            ├── abi.ts            # Contract ABI + address + state labels
            ├── wagmi.ts          # Wagmi config for RSK Testnet
            └── client.tsx        # Thirdweb client
```

---

## Tech Stack

### Smart Contract
| Tool | Version | Purpose |
|---|---|---|
| Solidity | 0.8.28 | Contract language |
| Hardhat | ^2 | Development framework |
| Hardhat Ignition | — | Deployment management |
| OpenZeppelin | ^5 | `ReentrancyGuard` |
| TypeChain | — | TypeScript type generation |
| Hardhat Toolbox | — | Testing (Chai, Mocha, Ethers) |

### Frontend
| Tool | Version | Purpose |
|---|---|---|
| Next.js | 16.2.1 | React framework (App Router) |
| React | 19.2.4 | UI library |
| Wagmi | 3.5.0 | Ethereum React hooks |
| Viem | 2.47.6 | Ethereum library |
| Thirdweb | 5.x | Wallet connect UI |
| TanStack Query | 5.x | Async state management |
| Tailwind CSS | 4 | Utility-first styling |
| TypeScript | 5 | Type safety |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- MetaMask with RSK Testnet configured
- tRBTC from the [RSK Testnet Faucet](https://faucet.rootstock.io)

### Smart Contract Setup

```bash
cd contracts
pnpm install
```

Set your Hardhat vars:

```bash
npx hardhat vars set PRIVATE_KEY
npx hardhat vars set ACCESS_TOKEN   # RSK Testnet RPC URL or API key
```

Compile and test:

```bash
npx hardhat compile
npx hardhat test
```

Deploy to RSK Testnet:

```bash
npx hardhat ignition deploy ignition/modules/FairPayEscrow.ts --network rskTestnet
```

### Frontend Setup

```bash
cd frontend
pnpm install
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
```

Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Smart Contract Reference

### Functions

| Function | Caller | State Required | Description |
|---|---|---|---|
| `createEscrow()` | Anyone | — | Create a new escrow agreement |
| `deposit()` | Client | Created | Fund the escrow, start work deadline |
| `cancelEscrow()` | Client | Funded | Refund client after work deadline passes |
| `submitWork(workLink)` | Freelancer | Funded | Submit deliverable before deadline |
| `approve()` | Client | UnderReview | Approve work and pay freelancer |
| `claimAfterReviewTimeout()` | Anyone | UnderReview | Pay freelancer after review period expires |
| `dispute(reason)` | Client | UnderReview | Raise dispute with written reason |
| `submitDisputeProof(proofLink)` | Freelancer | Disputed | Submit proof in response to dispute |
| `approveAfterDispute()` | Client | Disputed | Approve proof and pay freelancer |
| `withdrawDispute()` | Client | Disputed | Drop dispute, return to UnderReview |
| `acceptRefund()` | Freelancer | Disputed | Voluntarily return funds to client |
| `claimAfterDisputeTimeout()` | Anyone | Disputed | Enforce outcome after dispute deadline |

### Custom Errors

`OnlyClient` · `OnlyFreelancer` · `UnexpectedState` · `EscrowNotFound` · `ZeroAddress` · `ZeroDeposit` · `ZeroPeriod` · `ClientFreelancerSame` · `EmptyWorkLink` · `WorkDeadlineElapsed` · `WorkDeadlineNotElapsed` · `ReviewPeriodNotElapsed` · `DisputePeriodNotElapsed` · `FreelancerAlreadyResponded` · `DisputeNotResponded` · `TransferFailed`

---

## Network

| Property | Value |
|---|---|
| Network | RSK Testnet |
| Chain ID | 31 |
| Currency | tRBTC |
| RPC | `https://public-node.testnet.rsk.co` |
| Explorer | https://explorer.testnet.rootstock.io |
| Faucet | https://faucet.rootstock.io |

---

## Security

- All state-changing functions use the `escrowExists`, `onlyClient`/`onlyFreelancer`, and `inState` modifiers to prevent unauthorized calls
- ETH transfers use OpenZeppelin's `ReentrancyGuard` to prevent reentrancy attacks
- Work links and dispute proofs are stored as plain strings on-chain — visible only to the client and freelancer in the UI
- Funds are held by the contract and only released to the client or freelancer — never to a third party

---

## License

MIT
