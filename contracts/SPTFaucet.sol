// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

/**
 * Faucet for dashboard testing convenience
 * It is used only for local dev and testnet, and is not intended for Mainnet deployment.
 */

 import { IERC20 } from "./IERC20.sol";

 contract SPTFaucet {

    /// Token used for faucet operation
    IERC20 public token;

    /// Amount provided per request
    uint256 public distributionAmount;

    /// @notice Construct faucet contract with initial configuration
    constructor(address _token, uint256 _distributionAmount) {
        token = IERC20(_token);
        distributionAmount = _distributionAmount;
    }

    function request() external {
        require(token.balanceOf(address(this)) >= distributionAmount, "Not enough tokens");
        token.transfer(msg.sender, distributionAmount);
    }
     
 }