const { toBN, DAY_S } = require('../test/util');

const minimumStake = '1000';
const unstakeTime = DAY_S * 5;

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log(
    `Deploying contracts to ${network.name} with account: ${deployer.address}`,
    deployer.address,
  );

  console.log('Account balance:', (await deployer.getBalance()).toString());

  const tokenContract = await ethers.getContractFactory('SPT');
  const Staking = await ethers.getContractFactory('SPTStaking');
  const Locker = await ethers.getContractFactory('SPTLocker');
  const sptToken = await tokenContract.deploy();
  const sptLocker = await Locker.deploy(sptToken.address);
  const sptStaking = await Staking.deploy(
    sptToken.address, sptLocker.address, unstakeTime, minimumStake,
  );
  await sptLocker.setStakingContract(sptStaking.address);

  console.log('Token address:', sptToken.address);
  console.log('Staking address:', sptStaking.address);
  console.log('Locker address:', sptLocker.address);

  if(network.chainId === 3 || network.chainId === 1337) {
    // Transfer some ETH if we're on the local network
    if(network.chainId === 1337) {
      await deployer.sendTransaction({
        to: '0x15581c92DB672cC9316846aEF34DC46Ac95378c2',
        value: ethers.utils.parseEther('1.0'),
      });
      await sptStaking.addAdmin('0x15581c92DB672cC9316846aEF34DC46Ac95378c2');
    }
    const faucetContract = await ethers.getContractFactory('SPTFaucet');
    const faucet = await faucetContract.deploy(sptToken.address, toBN('100000e18'));
    await sptToken.transfer(faucet.address, toBN('1000000000e18'));
    console.log('Faucet address:', faucet.address);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
