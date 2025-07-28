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
const TOKEN_ADDRESS = "0x22fa7fd918a4364de63be573d8982af47d9cb6ba";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const UNISWAP_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

// === Setup ===
const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(PRIVATE_KEY, provider);

// Router ABI - only functions we need
const routerABI = [
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)",
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)",
    "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)"
];

// ERC20 ABI
const erc20ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

const router = new Contract(UNISWAP_ROUTER_ADDRESS, routerABI, wallet);
const token = new Contract(TOKEN_ADDRESS, erc20ABI, wallet);

async function swapAndAddLiquidity() {
    try {
        console.log("Starting swap and add liquidity process...");

        const amountInETH = parseEther("0.0005");
        const liquidityETH = parseEther("0.0005");
        const deadline = Math.floor(Date.now() / 1000) + 300;

        console.log(`Swapping ${formatEther(amountInETH)} ETH for tokens...`);

        const path = [WETH_ADDRESS, TOKEN_ADDRESS];
        const amountsOut = await router.getAmountsOut(amountInETH, path);
        const expectedTokens = amountsOut[1];
        const minTokensOut = expectedTokens * 95n / 100n;

        console.log(`Expected tokens: ${formatUnits(expectedTokens, 18)}`);
        console.log(`Min tokens (5% slippage): ${formatUnits(minTokensOut, 18)}`);

        const swapTx = await router.swapExactETHForTokens(
            minTokensOut,
            path,
            wallet.address,
            deadline,
            {
                value: amountInETH,
                gasLimit: 200000
            }
        );

        console.log(`Swap transaction sent: ${swapTx.hash}`);
        const swapReceipt = await swapTx.wait();
        console.log(`Swap confirmed in block: ${swapReceipt.blockNumber}`);

        const tokenBalance = await token.balanceOf(wallet.address);
        console.log(`Token balance after swap: ${formatUnits(tokenBalance, 18)}`);

        if (tokenBalance === 0n) throw new Error("No tokens received from swap");

        const currentAllowance = await token.allowance(wallet.address, UNISWAP_ROUTER_ADDRESS);
        console.log(`Current allowance: ${formatUnits(currentAllowance, 18)}`);

        if (currentAllowance < tokenBalance) {
            console.log("Approving tokens for router...");
            const approveTx = await token.approve(UNISWAP_ROUTER_ADDRESS, tokenBalance);
            console.log(`Approval transaction sent: ${approveTx.hash}`);
            await approveTx.wait();
            console.log("Approval confirmed");
        } else {
            console.log("Sufficient allowance already exists");
        }

        const minTokenAmount = tokenBalance * 95n / 100n;
        const minETHAmount = liquidityETH * 95n / 100n;

        console.log(`Adding liquidity: ${formatUnits(tokenBalance, 18)} tokens + ${formatEther(liquidityETH)} ETH`);

        const addLiquidityTx = await router.addLiquidityETH(
            TOKEN_ADDRESS,
            tokenBalance,
            minTokenAmount,
            minETHAmount,
            wallet.address,
            deadline,
            {
                value: liquidityETH,
                gasLimit: 250000
            }
        );

        const liquidityReceipt = await addLiquidityTx.wait();
        console.log(`Liquidity added successfully in block: ${liquidityReceipt.blockNumber}`);
        console.log(`Transaction hash: ${liquidityReceipt.hash}`);

        const finalTokenBalance = await token.balanceOf(wallet.address);
        const finalETHBalance = await provider.getBalance(wallet.address);

        console.log("\n=== Final Balances ===");
        console.log(`Token balance: ${formatUnits(finalTokenBalance, 18)}`);
        console.log(`ETH balance: ${formatEther(finalETHBalance)}`);

        return {
            swapHash: swapReceipt.hash,
            liquidityHash: liquidityReceipt.hash,
            tokensReceived: tokenBalance,
            liquidityAdded: true
        };

    } catch (error) {
        console.error("Error in swapAndAddLiquidity:", error);
        throw error;
    }
}

async function main() {
    try {
        console.log("🚀 Starting main()");
        console.log("wallet:", wallet.address);
        console.log("provider:", RPC_URL);
        console.log("token contract:", TOKEN_ADDRESS);

        const ethBalance = await provider.getBalance(wallet.address);
        const tokenBalance = await token.balanceOf(wallet.address);

        console.log("=== Initial Balances ===");
        console.log(`ETH balance: ${formatEther(ethBalance)}`);
        console.log(`Token balance: ${formatUnits(tokenBalance, 18)}`);
        console.log(`Wallet address: ${wallet.address}`);

        const requiredETH = parseEther("0.002"); // lower gas + swap + liquidity
        if (ethBalance < requiredETH) {
            throw new Error(`Insufficient ETH balance. Required: ${formatEther(requiredETH)}, Available: ${formatEther(ethBalance)}`);
        }

        const startTime = Date.now();
        const result = await swapAndAddLiquidity();
        const endTime = Date.now();

        console.log(`\n=== SUCCESS ===`);
        console.log(`Total execution time: ${endTime - startTime}ms`);
        console.log(`Swap transaction: ${result.swapHash}`);
        console.log(`Liquidity transaction: ${result.liquidityHash}`);
    } catch (error) {
        console.error("Main execution failed:", error.message);
        process.exit(1);
    }
}

main();
