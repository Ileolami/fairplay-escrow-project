import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { vars } from "hardhat/config";

const ACCESS_TOKEN = vars.has("ACCESS_TOKEN") ? vars.get("ACCESS_TOKEN") : "";
const PRIVATE_KEY = vars.has("PRIVATE_KEY") ? vars.get("PRIVATE_KEY") : "0x" + "0".repeat(64);

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    rskTestnet: {
      url: ACCESS_TOKEN,
      accounts: [PRIVATE_KEY],
      chainId: 31,
    },
  },
};

export default config;
