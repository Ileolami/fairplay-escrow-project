import "@nomicfoundation/hardhat-toolbox";

/** @type import('hardhat/config').HardhatUserConfig */
export const solidity = "0.8.28";

const { vars } = require("hardhat/config");

const ACCESS_TOKEN = vars.get("ACCESS_TOKEN");

const PRIVATE_KEY = vars.get("PRIVATE_KEY");

module.exports = {
  solidity: "0.8.28",
  networks: {
    sepolia: {
      url: `https://go.getblock.io/${ACCESS_TOKEN}`,
      accounts: [PRIVATE_KEY],
    },
  },
};
