# SPT Holdings Staking Contract

## Install

Install development environment
```
npm install
```

## Hardhat

[Hardhat](https://hardhat.org/) is used for development and contract deployment.

Compile contracts
```
npm run compile
```

## Environment Variables

* **UNSTAKE_PERIOD** - Period in which tokens are locked after un-staking
* **ROPSTEN_RPC_URL** - Full URL of Ropsten RPC provider
* **MAINNET_RPC_URL** - Full URL of Mainnet RPC provider
* **ROPSTEN_WALLET_KEY** - Private key for Ropsten deploy and management
* **MAINNET_WALLET_KEY** - Private key for Mainnet deploy and management
* **EVM_LOGGING** - Hardhat logging flag
* **TEST_REPORT_GAS** - Report gas usage for contract deploys and method calls in tests


## Testing

Javascript (Mocha) tests
```
npm run test
```

Solidity code coverage
```
npm run test:coverage
```

## Linting

Javascript linting
```
npm run lint
```

Solidity linting
```
npm run lint:solidity
```

# Contracts

## SPTStaking


## SPTToken


## SPTFaucet
