import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "dotenv/config";
import type { HardhatUserConfig } from "hardhat/config";

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
const etherscanKey = process.env.ETHERSCAN_API_KEY ?? "";
const accounts = deployerKey ? [deployerKey] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test/contracts",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    celo: {
      url: process.env.CELO_RPC ?? "https://forno.celo.org",
      chainId: 42220,
      accounts,
    },
    celoSepolia: {
      url: "https://forno.celo-sepolia.celo-testnet.org",
      chainId: 11142220,
      accounts,
    },
  },
  // Etherscan V2 unified API — one key works for every Etherscan-family
  // explorer, including Celoscan. Hardhat auto-routes by chain id.
  etherscan: {
    apiKey: etherscanKey,
  },
  sourcify: { enabled: false },
};

export default config;
