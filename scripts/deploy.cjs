const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying SimpleSwapAndAddLiquidity contract...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "ETH");

    // 🟢 گس‌پرایس دستی (مطمئن شوید بالا باشه)
    const gasPrice = ethers.parseUnits("35", "gwei"); // تغییر بده اگر ازدحام شبکه بالا بود
    const gasLimit = 1_000_000n;

    const ContractFactory = await ethers.getContractFactory("SimpleSwapAndAddLiquidity");
    const contract = await ContractFactory.deploy({
        gasPrice,
        gasLimit,
    });

    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();

    console.log("✅ Contract deployed at:", contractAddress);
}

main().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
});
