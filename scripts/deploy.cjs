const { ethers, network } = require("hardhat");
const fs = require("node:fs");
async function main() {
  if (
    network.name !== "xrplTestnet" ||
    Number((await ethers.provider.getNetwork()).chainId) !== 1449000
  )
    throw new Error(
      "Deployment is restricted to XRPL EVM Testnet chain 1449000.",
    );
  const [deployer] = await ethers.getSigners();
  if (!deployer)
    throw new Error(
      "Set DEPLOYER_PRIVATE_KEY in your local environment. Never paste it into chat or commit it.",
    );
  const names = [
    "SENIOR_WALLET",
    "JUNIOR_WALLET_1",
    "JUNIOR_WALLET_2",
    "FEE_WALLET",
  ];
  const addresses = names.map((n) => {
    const value = process.env[n];
    if (!value || !ethers.isAddress(value))
      throw new Error(
        `Set a valid ${n} public address in the local environment.`,
      );
    return ethers.getAddress(value);
  });
  const token = await (await ethers.getContractFactory("MockUSD")).deploy();
  await token.waitForDeployment();
  const block = await ethers.provider.getBlock("latest");
  const terms = {
    label: "Synthetic testnet deployment fixture",
    senior: 8000000,
    junior: [1000000, 500000],
    retention: 500000,
    seniorRate: 800,
    juniorRates: [1600, 1850],
    feeBps: 50,
  };
  const facility = await (
    await ethers.getContractFactory("BackstopFacility")
  ).deploy(
    await token.getAddress(),
    addresses[0],
    terms.senior,
    terms.seniorRate,
    terms.retention,
    [
      {
        investor: addresses[1],
        principal: terms.junior[0],
        rateBps: terms.juniorRates[0],
      },
      {
        investor: addresses[2],
        principal: terms.junior[1],
        rateBps: terms.juniorRates[1],
      },
    ],
    addresses[3],
    terms.feeBps,
    block.timestamp + 86400,
    ethers.id(JSON.stringify(terms)),
  );
  await facility.waitForDeployment();
  const record = {
    network: "XRPL EVM Testnet",
    chainId: 1449000,
    deployer: deployer.address,
    token: await token.getAddress(),
    facility: await facility.getAddress(),
    tokenTransaction: token.deploymentTransaction().hash,
    facilityTransaction: facility.deploymentTransaction().hash,
    terms,
    createdAt: new Date().toISOString(),
  };
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(
    "deployments/xrpl-testnet.json",
    JSON.stringify(record, null, 2) + "\n",
  );
  console.log(JSON.stringify(record, null, 2));
  console.log(
    `Facility explorer: https://explorer.testnet.xrplevm.org/address/${record.facility}`,
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
