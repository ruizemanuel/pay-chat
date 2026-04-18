import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import { config as loadEnv } from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";

// Load Next.js-style `.env.local` first (which is where secrets live), then
// fall back to `.env` without overriding anything already set.
loadEnv({ path: ".env.local" });
loadEnv();

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
  // Etherscan V2 unified API — one key covers every Etherscan-family
  // explorer; customChains teaches hardhat-verify about Celo.
  etherscan: {
    apiKey: etherscanKey,
    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://celoscan.io",
        },
      },
      {
        network: "celoSepolia",
        chainId: 11142220,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://sepolia.celoscan.io",
        },
      },
    ],
  },
  sourcify: { enabled: false },
};

export default config;
