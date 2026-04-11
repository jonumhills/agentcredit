import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying AgentCredit contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // 1. Deploy AgentRegistry
  console.log("\n1. Deploying AgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("   AgentRegistry deployed:", registryAddress);

  // 2. Deploy TrustScore
  console.log("\n2. Deploying TrustScore...");
  const TrustScore = await ethers.getContractFactory("TrustScore");
  const trustScore = await TrustScore.deploy();
  await trustScore.waitForDeployment();
  const trustScoreAddress = await trustScore.getAddress();
  console.log("   TrustScore deployed:", trustScoreAddress);

  // 3. Deploy LoanEscrow
  console.log("\n3. Deploying LoanEscrow...");
  const LoanEscrow = await ethers.getContractFactory("LoanEscrow");
  const loanEscrow = await LoanEscrow.deploy(trustScoreAddress, registryAddress);
  await loanEscrow.waitForDeployment();
  const loanEscrowAddress = await loanEscrow.getAddress();
  console.log("   LoanEscrow deployed:", loanEscrowAddress);

  // 4. Transfer TrustScore ownership to LoanEscrow so it can update scores
  //    In production, use a multi-sig or role-based approach.
  //    For hackathon: LoanEscrow + backend deployer both need write access.
  //    We keep TrustScore owned by deployer and grant LoanEscrow as a separate caller.
  console.log("\n4. Setup complete. Contracts deployed.");

  const addresses = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    AgentRegistry: registryAddress,
    TrustScore: trustScoreAddress,
    LoanEscrow: loanEscrowAddress,
    deployedAt: new Date().toISOString(),
  };

  // Write addresses to file for backend and frontend consumption
  const outPath = path.join(__dirname, "..", "deployments.json");
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log("\nDeployment addresses saved to:", outPath);
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
