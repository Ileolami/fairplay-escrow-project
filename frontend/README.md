# FairPlay Escrow UI

This is a frontend for the FairPlay Escrow contract. It allows users to create escrows, deposit funds, submit work, and resolve disputes. It is built with [Next.js](https://nextjs.org/) and [Wagmi](https://wagmi.sh/).

## Dependencies

This project uses the following dependencies:

- [Next.js](https://nextjs.org/) - React framework for production
- [Wagmi](https://wagmi.sh/) - React hooks for Ethereum
- [Thirdweb](https://thirdweb.com/) - Web3 wallet provider
- [Viem](https://viem.sh/) - Ethereum library
- [TanStack Query](https://tanstack.com/query/v5) - React hooks for data fetching
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework
- [TypeScript](https://www.typescriptlang.org/) - Programming language

## Project Setup

To run this project, you need to have [Node.js](https://nodejs.org/en/) and [PNPM](https://pnpm.io/) installed on your computer. Then, run the following commands:

```bash
pnpm install
```

## Running the Project

To run the project, run the following command:

```bash
pnpm dev
```

The project will be available at [http://localhost:3000](http://localhost:3000).

## Project Structure

The project is structured as follows:

```bash
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx — Next.js app routes
│   │   ├── providers.tsx — React providers
│   │   ├── layout.tsx — Next.js layout
│   │   └── globals.css — global styles
│   ├── components/ — React components
│   │   ├── EscrowCard.tsx — Escrow card component
│   │   ├── EscrowList.tsx — Escrow list component
│   │   ├── CreateEscrow.tsx — Create escrow form
│   │   └── Header.tsx — Navigation header
│   │   └── connectBtn.tsx — Wallet connect button
│   ├── lib/ — utility functions
│   │   ├── abi.ts — contract ABI and address
│   │   └── client.ts — Wagmi client
├── public/ — static files
└── next.config.js — Next.js config
```