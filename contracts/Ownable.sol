// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

contract Ownable {
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function isOwner(address account) public view returns (bool) {
        if( account == owner ){
            return true;
        }
        else {
            return false;
        }
    }
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "No transfer to 0");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
