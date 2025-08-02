import {
    JsonRpcProvider,
    Wallet,
    Contract,
    parseEther,
    formatEther,
    formatUnits
} from "ethers";
import dotenv from "dotenv";

dotenv.config();

// === Constants ===
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS; // Add this to your .env file after deployment
const TOKEN_ADDRESS = "0x22fa7fd918a4364de63be573d8982af47d9cb6ba";

// === Setup ===
const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(PRIVATE_KEY, provider);

// Contract ABI - only the functions we need
const contractABI = [
    "function swapAndAddLiquidity(address token, uint256 swapSlippageBps, uint256 liquiditySlippageBps) external payable",
    "function getExpectedTokenOutput(address token, uint256 ethAmount) external view returns (uint256)",
    "event SwapAndLiquidityAdded(address indexed user, address indexed token, uint256 ethSwapped, uint256 tokensReceived, uint256 liquidityTokens, uint256 liquidityETH, uint256 liquidityMinted)"
];

// ERC20 ABI for balance checks
const erc20ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
];

const contract = new Contract(CONTRACT_ADDRESS, contractABI, wallet);
const token = new Contract(TOKEN_ADDRESS, erc20ABI, provider);

async function executeSwapAndAddLiquidity() {
    try {
        console.log("🚀 Starting single-transaction swap and add liquidity...");

        const ethAmount = parseEther("0.001"); // Total ETH to use (will be split 50/50)
        const swapSlippage = 500; // 5% slippage for swap
        const liquiditySlippage = 500; // 5% slippage for liquidity

        console.log(`Total ETH amount: ${formatEther(ethAmount)}`);
        console.log(`ETH for swap: ${formatEther(ethAmount / 2n)}`);
        console.log(`ETH for liquidity: ${formatEther(ethAmount / 2n)}`);

        // Get expected token output for swap portion
        const expectedTokens = await contract.getExpectedTokenOutput(TOKEN_ADDRESS, ethAmount / 2n);
        console.log(`Expected tokens from swap: ${formatUnits(expectedTokens, 18)}`);

        // Get initial balances
        const initialETHBalance = await provider.getBalance(wallet.address);
        const initialTokenBalance = await token.balanceOf(wallet.address);

        console.log("\n=== Initial Balances ===");
        console.log(`ETH balance: ${formatEther(initialETHBalance)}`);
        console.log(`Token balance: ${formatUnits(initialTokenBalance, 18)}`);

        // Check if we have enough ETH
        const requiredETH = ethAmount + parseEther("0.01"); // Add buffer for gas
        if (initialETHBalance < requiredETH) {
            throw new Error(`Insufficient ETH balance. Required: ${formatEther(requiredETH)}, Available: ${formatEther(initialETHBalance)}`);
        }

        console.log("\n=== Executing Transaction ===");
        const startTime = Date.now();

        // Execute the single transaction
        const tx = await contract.swapAndAddLiquidity(
            TOKEN_ADDRESS,
            swapSlippage,
            liquiditySlippage,
            {
                value: ethAmount,
                gasLimit: 500000 // Higher gas limit for complex transaction
            }
        );

        console.log(`Transaction sent: ${tx.hash}`);
        console.log("Waiting for confirmation...");

        const receipt = await tx.wait();
        const endTime = Date.now();

        console.log(`✅ Transaction confirmed in block: ${receipt.blockNumber}`);
        console.log(`⏱️  Total execution time: ${endTime - startTime}ms`);
        console.log(`⛽ Gas used: ${receipt.gasUsed.toString()}`);

        // Parse the event to get details
        const eventFilter = contract.filters.SwapAndLiquidityAdded();
        const events = await contract.queryFilter(eventFilter, receipt.blockNumber, receipt.blockNumber);

        if (events.length > 0) {
            const event = events[0];
            console.log("\n=== Transaction Details ===");
            console.log(`ETH swapped: ${formatEther(event.args.ethSwapped)}`);
            console.log(`Tokens received: ${formatUnits(event.args.tokensReceived, 18)}`);
            console.log(`Liquidity tokens used: ${formatUnits(event.args.liquidityTokens, 18)}`);
            console.log(`Liquidity ETH used: ${formatEther(event.args.liquidityETH)}`);
            console.log(`LP tokens minted: ${formatUnits(event.args.liquidityMinted, 18)}`);
        }

        // Get final balances
        const finalETHBalance = await provider.getBalance(wallet.address);
        const finalTokenBalance = await token.balanceOf(wallet.address);

        console.log("\n=== Final Balances ===");
        console.log(`ETH balance: ${formatEther(finalETHBalance)}`);
        console.log(`Token balance: ${formatUnits(finalTokenBalance, 18)}`);

        console.log("\n=== Balance Changes ===");
        console.log(`ETH change: ${formatEther(finalETHBalance - initialETHBalance)}`);
        console.log(`Token change: ${formatUnits(finalTokenBalance - initialTokenBalance, 18)}`);

        return {
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            executionTime: endTime - startTime,
            success: true
        };

    } catch (error) {
        console.error("❌ Error in executeSwapAndAddLiquidity:", error);

        // Enhanced error handling
        if (error.code === 'INSUFFICIENT_FUNDS') {
            console.error("💰 Insufficient ETH balance for transaction");
        } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
            console.error("⛽ Gas estimation failed - transaction would likely fail");
        } else if (error.message?.includes('INSUFFICIENT_OUTPUT_AMOUNT')) {
            console.error("📉 Slippage too high - try increasing slippage tolerance");
        } else if (error.message?.includes('EXPIRED')) {
            console.error("⏰ Transaction deadline expired");
        } else if (error.reason) {
            console.error(`🔴 Contract revert: ${error.reason}`);
        }

        throw error;
    }
}

async function main() {
    try {
        console.log("=== Configuration ===");
        console.log(`Wallet: ${wallet.address}`);
        console.log(`Contract: ${CONTRACT_ADDRESS}`);
        console.log(`Token: ${TOKEN_ADDRESS}`);
        console.log(`RPC: ${RPC_URL}`);

        // Get token info
        try {
            const tokenSymbol = await token.symbol();
            const tokenDecimals = await token.decimals();
            console.log(`Token: ${tokenSymbol} (${tokenDecimals} decimals)`);
        } catch (e) {
            console.log("Could not fetch token info");
        }

        const result = await executeSwapAndAddLiquidity();

        console.log("\n🎉 === SUCCESS ===");
        console.log(`Transaction: ${result.transactionHash}`);
        console.log(`Block: ${result.blockNumber}`);
        console.log(`Gas Used: ${result.gasUsed}`);
        console.log(`Execution Time: ${result.executionTime}ms`);

    } catch (error) {
        console.error("💥 Main execution failed:", error.message);
        process.exit(1);
    }
}

// Add error handling for unhandled rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    process.exit(1);
});

main();