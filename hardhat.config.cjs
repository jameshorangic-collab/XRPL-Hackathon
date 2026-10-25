if (require("node:fs").existsSync(".env")) process.loadEnvFile(".env");
require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { viaIR: true, optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
    xrplTestnet: {
      url: process.env.XRPL_EVM_RPC_URL || "https://rpc.testnet.xrplevm.org",
      chainId: 1449000,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
  paths: { tests: "./test" },
};
