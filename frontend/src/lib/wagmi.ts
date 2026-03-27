import { createConfig, http, injected } from "wagmi";
import { defineChain } from "viem";

export const rskTestnet = defineChain({
  id: 31,
  name: "RSK Testnet",
  nativeCurrency: { name: "Test RBTC", symbol: "tRBTC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://public-node.testnet.rsk.co"] },
  },
  blockExplorers: {
    default: {
      name: "RSK Testnet Explorer",
      url: "https://explorer.testnet.rsk.co",
    },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [rskTestnet],
  connectors: [injected()],
  transports: {
    [rskTestnet.id]: http("https://public-node.testnet.rsk.co", { timeout: 300_000 }),
  },
});