require('dotenv').config();

require('@nomiclabs/hardhat-solhint');
require('@nomiclabs/hardhat-waffle');
require('hardhat-deploy');
require('hardhat-gas-reporter');
require('hardhat-contract-sizer');
require('hardhat-abi-exporter');
require('solidity-coverage');

const loggingEnabled = process.env.EVM_LOGGING === '1';
const testReportGas = process.env.TEST_REPORT_GAS === '1';
const ropstenRpcUrl = process.env.ROPSTEN_RPC_URL;
const ropstenWalletKey = process.env.ROPSTEN_WALLET_KEY;
const mainnetRpcUrl = process.env.MAINNET_RPC_URL;
const mainnetWalletKey = process.env.MAINNET_WALLET_KEY;

const networks = {
  // This is used as a profile for booting up the local network / testing
  hardhat: {
    logged: loggingEnabled,
    chainId: 1337,
    auto: false,
    interval: 5000,
  },
};

if(ropstenRpcUrl && ropstenWalletKey) {
  networks.ropsten = {
    chainId: 3,
    url: ropstenRpcUrl,
    timeout: 60000,
    accounts: [ropstenWalletKey],
  };
}

if(mainnetRpcUrl && mainnetWalletKey) {
  networks.mainnet = {
    chainId: 1,
    url: mainnetRpcUrl,
    timeout: 60000,
    accounts: [mainnetWalletKey],
  };
}

module.exports = {
  defaultNetwork: 'hardhat',
  networks,
  gasReporter: {
    enabled: testReportGas,
    showMethodSig: true,
  },
  abiExporter: {
    clear: true,
    flat: true,
  },
  solidity: {
    version: '0.8.4',
  },
};
