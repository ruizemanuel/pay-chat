import { ethers, network } from "hardhat";

async function main() {
  const initialOwner = process.env.SERVER_WALLET_ADDRESS;
  if (!initialOwner) {
    throw new Error("SERVER_WALLET_ADDRESS env var is required");
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(initialOwner)) {
    throw new Error(`SERVER_WALLET_ADDRESS is not a valid address: ${initialOwner}`);
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log(`Network:           ${network.name} (chainId ${chainId})`);
  console.log(`Deployer:          ${deployer.address}`);
  console.log(`Deployer balance:  ${ethers.formatEther(balance)} native`);
  console.log(`Initial owner:     ${initialOwner}`);
  console.log("");

  const factory = await ethers.getContractFactory("PromptReceipt");
  const contract = await factory.deploy(initialOwner);
  const deployTx = contract.deploymentTransaction();
  console.log(`Deploy tx:         ${deployTx?.hash ?? "(unknown)"}`);

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("");
  console.log(`PromptReceipt:     ${address}`);
  console.log("");
  console.log("Verify with:");
  console.log(
    `  TS_NODE_PROJECT=tsconfig.hardhat.json pnpm hardhat verify --network ${network.name} ${address} ${initialOwner}`,
  );
  console.log("");
  console.log(`Add to .env.local:`);
  console.log(`  NEXT_PUBLIC_PROMPT_RECEIPT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
