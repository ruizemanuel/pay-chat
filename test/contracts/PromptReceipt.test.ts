import { expect } from "chai";
import { ethers } from "hardhat";

describe("PromptReceipt", () => {
  async function deploy() {
    const [owner, user, stranger] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("PromptReceipt");
    const contract = await factory.deploy(owner.address);
    await contract.waitForDeployment();
    return { contract, owner, user, stranger };
  }

  it("emits PromptPaid with the expected fields when called by the owner", async () => {
    const { contract, owner, user } = await deploy();
    const model = "groq/llama-3.3-70b";
    const queryHash = ethers.keccak256(ethers.toUtf8Bytes("what is celo?"));

    await expect(
      contract.connect(owner).logPrompt(user.address, model, queryHash),
    )
      .to.emit(contract, "PromptPaid")
      .withArgs(
        user.address,
        model,
        queryHash,
        // timestamp is set by the EVM; only assert on the other fields above
        (value: bigint) => typeof value === "bigint" && value > 0n,
      );
  });

  it("reverts when a non-owner calls logPrompt", async () => {
    const { contract, user, stranger } = await deploy();
    const queryHash = ethers.keccak256(ethers.toUtf8Bytes("test"));

    await expect(
      contract.connect(stranger).logPrompt(user.address, "any", queryHash),
    ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
  });

  it("records the caller-supplied model string verbatim", async () => {
    const { contract, owner, user } = await deploy();
    const model = "openai/gpt-4o-mini";
    const queryHash = ethers.keccak256(ethers.toUtf8Bytes("hola"));

    const tx = await contract
      .connect(owner)
      .logPrompt(user.address, model, queryHash);
    const receipt = await tx.wait();
    const eventLog = receipt?.logs.find((log) => {
      try {
        return (
          contract.interface.parseLog(log as unknown as { topics: string[]; data: string })
            ?.name === "PromptPaid"
        );
      } catch {
        return false;
      }
    });
    expect(eventLog, "PromptPaid event not found").to.exist;
    const parsed = contract.interface.parseLog(
      eventLog as unknown as { topics: string[]; data: string },
    );
    expect(parsed?.args.model).to.equal(model);
  });
});
