// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
/// @notice Unrestricted minting for LOCAL AND TESTNET DEMOS ONLY. This is not RLUSD.
contract MockUSD is ERC20 {
    constructor() ERC20('BACKSTOP Mock USD', 'mUSD') {}
    function decimals() public pure override returns (uint8) { return 2; }
    function mint(address recipient, uint256 amount) external { _mint(recipient, amount); }
}
