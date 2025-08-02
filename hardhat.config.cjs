require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
    solidity: {
        version: "0.8.19",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            viaIR: true
        }
    },
    networks: {
        mainnet: {
            url: process.env.RPC_URL,
            accounts: [process.env.PRIVATE_KEY],
            gasPrice: 20000000000, // 20 gwei
        },
        sepolia: {
            url: process.env.RPC_URL,
            accounts: [process.env.PRIVATE_KEY],
        }
    }
};