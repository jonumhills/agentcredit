import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const rawKey = process.env.DEPLOYER_PRIVATE_KEY || "";
const DEPLOYER_PRIVATE_KEY =
  rawKey.startsWith("0x") && rawKey.length === 66 ? rawKey : "0x" + "0".repeat(64);
const hasKey = rawKey.startsWith("0x") && rawKey.length === 66;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    ...(hasKey && {
      xlayer: {
        url: process.env.XLAYER_RPC_URL || "https://xlayerrpc.okx.com",
        chainId: 196,
        accounts: [DEPLOYER_PRIVATE_KEY],
      },
      xlayerTestnet: {
        url: process.env.XLAYER_TESTNET_RPC_URL || "https://testrpc.xlayer.tech",
        chainId: 1952,
        accounts: [DEPLOYER_PRIVATE_KEY],
      },
    }),
  },
  etherscan: {
    apiKey: {
      xlayer: process.env.OKLINK_API_KEY || "",
    },
    customChains: [
      {
        network: "xlayer",
        chainId: 196,
        urls: {
          apiURL: "https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER",
          browserURL: "https://www.oklink.com/xlayer",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
