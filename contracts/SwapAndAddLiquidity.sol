// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IUniswapV2Router {
    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);
    
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity);
    
    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
        
    function WETH() external pure returns (address);
}

contract SimpleSwapAndAddLiquidity {
    IUniswapV2Router public constant router = IUniswapV2Router(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    address public constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    
    event Complete(address user, address token, uint256 liquidity);
    
    function execute(address token, uint256 slippage) external payable {
        require(msg.value > 0, "Need ETH");
        require(slippage <= 1000, "Max 10%");
        
        uint256 half = msg.value / 2;
        
        // Swap
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = token;
        
        uint256[] memory amounts = router.swapExactETHForTokens{value: half}(
            0, // Accept any amount
            path,
            address(this),
            block.timestamp + 300
        );
        
        // Add liquidity
        IERC20(token).approve(address(router), amounts[1]);
        
        (, , uint256 liquidity) = router.addLiquidityETH{value: half}(
            token,
            amounts[1],
            0, // Accept any amount
            0, // Accept any amount
            msg.sender,
            block.timestamp + 300
        );
        
        // Refund excess tokens
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).transfer(msg.sender, balance);
        }
        
        emit Complete(msg.sender, token, liquidity);
    }
    
    function getTokenAmount(address token, uint256 ethAmount) external view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = token;
        return router.getAmountsOut(ethAmount, path)[1];
    }
    
    receive() external payable {}
}