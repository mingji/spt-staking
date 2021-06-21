const assert = require('assert');
const {
  toBN,
  assertBalance,
  assertStake,
  assertUnstake,
  assertWithdraw,
  assertReinvest,
  shouldRevert,
  assertBN,
  postDividend,
  UNSTAKE_TIME,
} = require('./util');

describe('Token contract', () => {
  const minimumStake = toBN(1000);
  // 30 days unstake time
  const unstakeTime = toBN(UNSTAKE_TIME);
  let Staking;
  let Locker;
  let sptStaking;
  let sptLocker;
  let sptToken;
  let owner;
  let u1;
  let u2;
  let u3;
  let u4;

  before(async () => {
    const tokenContract = await ethers.getContractFactory('SPT');
    Staking = await ethers.getContractFactory('SPTStaking');
    Locker = await ethers.getContractFactory('SPTLocker');
    [owner, u1, u2, u3, u4] = await ethers.getSigners();

    sptToken = await tokenContract.deploy();
    sptLocker = await Locker.deploy(sptToken.address);
    await sptToken.deployed();
  });

  beforeEach(async () => {
    sptStaking = await Staking.deploy(
      sptToken.address, sptLocker.address, unstakeTime, minimumStake,
    );
    sptLocker.setStakingContract(sptStaking.address);
  });

  it('Should set the owner and send tokens', async () => {
    assert.strictEqual(await sptStaking.owner(), owner.address);

    // 10M tokens
    const initialTokens = toBN('10000000e18');

    await sptToken.transfer(u1.address, initialTokens);
    await sptToken.transfer(u2.address, initialTokens);
    await sptToken.transfer(u3.address, initialTokens);
    await sptToken.transfer(u4.address, initialTokens);

    await assertBalance(sptToken, u1.address, initialTokens);
    await assertBalance(sptToken, u2.address, initialTokens);
    await assertBalance(sptToken, u3.address, initialTokens);
    await assertBalance(sptToken, u4.address, initialTokens);
  });

  it('Check staking error conditions', async () => {
    // 1M tokens
    const stake = toBN('1000000e18');

    // Stake without approval
    await shouldRevert(sptStaking.stake(stake), 'Allowance low');

    // Stake below minimum
    const low = minimumStake - toBN(1);
    await sptToken.approve(sptStaking.address, low);
    await shouldRevert(sptStaking.stake(low), 'Stake too low');

    // Only admin can post dividends
    await shouldRevert(
      sptStaking.connect(u1).postDividend(stake),
      'Only admin',
    );
  });

  it('Should unstake correctly without rewards', async () => {
    // 1M tokens
    const stake = toBN('1000000e18');
    await assertStake({
      sptToken,
      sptStaking,
      signers: [u1, u2, u3],
      stake,
    });

    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u1, expectedTpa: stake });
    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u2, expectedTpa: stake });
    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u3, expectedTpa: stake });
  });

  it('Should unstake correctly with rewards', async () => {
    // 1M tokens
    const stake = toBN('1000000e18');
    await assertStake({
      sptToken,
      sptStaking,
      signers: [u1, u2, u3],
      stake,
    });

    await postDividend(sptToken, sptStaking, stake);

    // First and second unstaker should get 1/3 of 4M
    let expectedTpa = (stake * toBN('4')) / toBN('3');
    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u1, expectedTpa });
    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u2, expectedTpa });

    // Add an admin for posting dividends
    await sptStaking.addAdmin(u1.address);
    await sptToken.connect(u1).approve(sptStaking.address, stake);
    await sptStaking.connect(u1).postDividend(stake);

    // Last staker should get remainder of pool
    expectedTpa = await sptToken.balanceOf(sptStaking.address);
    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u3, expectedTpa });

    assertBalance(sptToken, sptStaking.address, 0);
    const stakedSPT = await sptStaking.stakedSPT();
    const totalPool = await sptToken.balanceOf(sptStaking.address);

    assertBN(stakedSPT, toBN(0), 'Staked SPT not 0');
    assertBN(totalPool, toBN(0), 'Total pool not 0');
  });

  it('Handles dividend edge cases', async () => {
    // Can't post dividends if there are no stakers
    const stake = toBN('1000000e18');
    await sptToken.approve(sptStaking.address, stake);
    await shouldRevert(sptStaking.postDividend(stake), 'No stakers');

    await assertStake({
      sptToken,
      sptStaking,
      signers: [u1],
      stake,
    });

    // Removed admin cannot post dividend
    await sptStaking.removeAdmin(u1.address);
    await sptToken.connect(u1).approve(sptStaking.address, stake);
    await shouldRevert(sptStaking.connect(u1).postDividend(stake), 'Only admin');

    // Two dividends without new stakers in between are merged
    await sptStaking.postDividend(stake);
    await postDividend(sptToken, sptStaking, stake);
    let count = toBN(await sptStaking.getDividendCount());
    assertBN(count, 1);

    await assertStake({
      sptToken,
      sptStaking,
      signers: [u2],
      stake,
    });
    await postDividend(sptToken, sptStaking, stake);
    // Dividend should not be merged
    count = toBN(await sptStaking.getDividendCount());
    assertBN(count, 2);

    // u2 gets half of second dividend
    let expectedTpa = stake + (stake / toBN(2));
    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u2, expectedTpa });
    // u1 gets remainder of second dividend plus first 2 dividends
    expectedTpa = stake + (stake * toBN(2)) + (stake / toBN(2));
    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u1, expectedTpa });
  });

  it('Can reinvest and withdraw dividends', async () => {
    const stake = toBN('1000000e18');
    await assertStake({
      sptToken,
      sptStaking,
      signers: [u1, u2],
      stake,
    });

    const div1 = toBN('2000000e18');
    await postDividend(sptToken, sptStaking, div1);

    // u1 withdraws
    let expectedTpa = div1 / toBN('2');
    await assertWithdraw({ sptToken, sptStaking, signer: u1, expectedTpa });
    // u2 reinvests
    const expectedStake = stake + div1 / toBN('2');
    await assertReinvest({ sptStaking, signer: u2, expectedStake });

    // Another user stakes
    await assertStake({
      sptToken,
      sptStaking,
      signers: [u3],
      stake,
    });

    const div2 = toBN('4000000e18');
    await postDividend(sptToken, sptStaking, div2);

    // Stakes: u1=1M, u2=2M, u3=1M
    expectedTpa = stake + div2 / toBN('4');
    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u1, expectedTpa });
    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u3, expectedTpa });
    expectedTpa = stake * toBN('2') + div2 / toBN('2');
    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u2, expectedTpa });
  });

  it('Works with complex staking/rewards', async () => {
    const stake1 = toBN('1000000e18');
    await assertStake({
      sptToken,
      sptStaking,
      signers: [u1],
      stake: stake1,
    });
    const stake2 = toBN('2000000e18');
    await assertStake({
      sptToken,
      sptStaking,
      signers: [u2],
      stake: stake2,
    });
    // Pool = 3M, Div1 = 2M
    const div1 = toBN('2000000e18');
    await postDividend(sptToken, sptStaking, div1);

    const stake3 = toBN('4000000e18');
    await assertStake({
      sptToken,
      sptStaking,
      signers: [u3],
      stake: stake3,
    });

    // Should receive original stake with no reward
    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u3, expectedTpa: stake3 });

    // Stake twice
    await assertStake({
      sptToken,
      sptStaking,
      signers: [u3],
      stake: stake3,
    });
    const stake4 = toBN('4000000e18');
    await assertStake({
      sptToken,
      sptStaking,
      signers: [u3],
      stake: stake4,
    });

    // Receive first and second stake with no reward
    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u3, expectedTpa: stake3 + stake4 });

    const stake5 = toBN('7000000e18');
    await assertStake({
      sptToken,
      sptStaking,
      signers: [u3],
      stake: stake5,
    });

    // Pool = 10M, Div1 = 2M(3M stake), Div2 = 10M(10M stake)
    const div2 = toBN('10000000e18');
    await postDividend(sptToken, sptStaking, div2);

    let expectedTpa = stake1 + (stake1 * div1) / toBN('3e24') + (stake1 * div2) / toBN('10e24');
    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u1, expectedTpa });
    // Add one for rounding since u2 gets the remainder of the first pool
    expectedTpa = toBN(1) + stake2 + (stake2 * div1) / toBN('3e24') + (stake2 * div2) / toBN('10e24');
    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u2, expectedTpa });
    expectedTpa = stake5 + (stake5 * div2) / toBN('10e24');
    await assertUnstake({ sptToken, sptStaking, sptLocker, signer: u3, expectedTpa });
  });
});
