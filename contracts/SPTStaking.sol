
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import { Ownable } from "./Ownable.sol";
import { Admin } from "./Admin.sol";
import { SPTLocker } from "./SPTLocker.sol";
import { IERC20 } from "./IERC20.sol";

contract SPTStaking is Ownable, Admin {

    event Staked(address staker, uint256 amount);
    event Unstaked(address staker, uint256 amount);
    event DividendPosted(uint256 amount);
    event Withdrawal(address staker, uint256 amount);
    event Reinvest(address staker, uint256 amount);

    struct Stake {
        // The amount of SPT staked
        uint256 stake;
        // Index into the list of dividends for retrieving interest
        uint256 dividendIndex;
    }

    struct Dividend {
        // Original dividend amount
        uint256 originalAmount;
        // Dividend amount, minus realized gains
        uint256 amount;
        // Snapshot of total stake at the time of dividend posting
        uint256 totalStakeSnapshot;
    }

    /// Token used for staking operations
    IERC20 public token;

    /// Locker to hold tokens after unstaking
    SPTLocker public locker;

    /// Map of wallets to SPT stakes
    mapping(address => Stake) public stakes;

    /// List of posted dividends
    Dividend[] public dividends;

    /// Total SPT staked in the contract (not including rewards)
    uint256 public stakedSPT;

    /// Minimum stakeable amount
    uint256 public minimumStake;

    /// The amount of time unstaked tokens are locked for (seconds)
    uint256 public unstakeTime;

    /// @notice Construct staking contract with initial configuration
    constructor(address _token, address _sptLocker, uint256 _unstakeTime, uint256 _minimumStake) {
        token = IERC20(_token);
        locker = SPTLocker(_sptLocker);
        unstakeTime = _unstakeTime;
        minimumStake = _minimumStake;
    }

    function getDividendCount() public view returns(uint256) {
        return dividends.length;
    }

    function getStake(address staker) public view returns(uint256) {
        return stakes[staker].stake;
    }

    function unrealizedGains(address staker) public view returns(uint256) {
        Stake storage stakeData = stakes[staker];
        uint256 gains = 0;
        if(stakeData.stake == 0) {
            return 0;
        }

        for(uint256 i = stakeData.dividendIndex; i < dividends.length; i += 1) {
            gains += (stakeData.stake * dividends[i].amount) / dividends[i].totalStakeSnapshot;
        }
        return gains;
    }

    function postDividend(uint256 amount) external onlyAdmin {
        require(stakedSPT > 0, "No stakers");
        uint256 allowance = token.allowance(msg.sender, address(this));
        require(allowance >= amount, "Allowance low");

        // If the stake pool has changed, or gains have been realized, post a new dividend
        uint256 divLen = dividends.length;
        if(
            divLen == 0
            || stakedSPT != dividends[divLen - 1].totalStakeSnapshot
            || dividends[divLen - 1].amount != dividends[divLen - 1].originalAmount
        ) {
            dividends.push(Dividend({
                originalAmount: amount,
                amount: amount,
                totalStakeSnapshot: stakedSPT
            }));
        // If the stake pool hasn't changed
        } else {
            dividends[divLen - 1].originalAmount += amount;
            dividends[divLen - 1].amount += amount;
        }
        token.transferFrom(msg.sender, address(this), amount);

        emit DividendPosted(amount);
    }

    function stake(uint256 amount) public {
        require(amount >= minimumStake, "Stake too low");
        uint256 allowance = token.allowance(msg.sender, address(this));
        require(allowance >= amount, "Allowance low");
        Stake storage stakeData = stakes[msg.sender];
        if(stakeData.stake > 0) {
            // If there is an existing stake, we need to ensure there are no unrealized gains
            _reinvest();
        }

        stakeData.stake += amount;
        stakeData.dividendIndex = dividends.length;
        stakedSPT += amount;

        token.transferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function unstake() public {
        Stake storage stakeData = stakes[msg.sender];
        require(stakeData.stake > 0, "No stake");
        uint256 gains = _updateDividends();
        uint256 total = stakeData.stake + gains;

        stakedSPT -= stakeData.stake;
        stakeData.stake = 0;
        stakeData.dividendIndex = 0;

        token.transfer(address(locker), total);
        uint256 releaseTime = block.timestamp + unstakeTime;

        locker.stakingLock(msg.sender, total, releaseTime);
        emit Unstaked(msg.sender, total);
    }

    function _updateDividends() private returns(uint256) {
        Stake storage stakeData = stakes[msg.sender];
        uint256 gains = 0;

        for(uint256 i = stakeData.dividendIndex; i < dividends.length; i += 1) {
            Dividend storage div = dividends[i];
            uint256 remainingStake = div.totalStakeSnapshot - stakeData.stake;
            // Last withdrawal gets remainder, to avoid rounding issues
            uint256 amount = div.amount;
            if(remainingStake != 0) {
                amount = (stakeData.stake * amount) / div.totalStakeSnapshot;
            }
            div.amount -= amount;
            div.totalStakeSnapshot -= stakeData.stake;
            gains += amount;
        }
        stakeData.dividendIndex = dividends.length;
        return gains;
    }

    function _reinvest() private returns(uint256) {
        Stake storage stakeData = stakes[msg.sender];
        uint256 gains = _updateDividends();
        stakeData.stake += gains;
        stakedSPT += gains;
        return gains;
    }

    function withdrawDividends() public {
        uint256 staked = stakes[msg.sender].stake;
        require(staked > 0, "No stake");

        uint256 gains = _updateDividends();
        token.transfer(msg.sender, gains);

        emit Withdrawal(msg.sender, gains);
    }

    function reinvest() public {
        uint256 staked = stakes[msg.sender].stake;
        require(staked > 0, "No stake");

        uint256 gains = _reinvest();

        emit Reinvest(msg.sender, gains);
    }
}
