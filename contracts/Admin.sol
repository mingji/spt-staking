// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

contract Admin {

    /// Map of addresses able to perform admin actions
    mapping(address => bool) public admins;

    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    constructor() {
        admins[msg.sender] = true;
    }

    modifier onlyAdmin() {
        require(admins[msg.sender], "Only admin");
        _;
    }

    function isAdmin(address account) public view returns (bool) {
        return admins[account];
    }
    function addAdmin(address newAdmin) public onlyAdmin {
        admins[newAdmin] = true;
        emit AdminAdded(newAdmin);
    }
    function removeAdmin(address newAdmin) public onlyAdmin {
        admins[newAdmin] = false;
        emit AdminRemoved(newAdmin);
    }
}
