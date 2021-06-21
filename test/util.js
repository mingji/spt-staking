const assert = require('assert');

const DAY_S = 60 * 60 * 24;
const UNSTAKE_DAYS = 30;
const UNSTAKE_TIME = DAY_S * UNSTAKE_DAYS;

const parseSci = (value) => {
  const eInd = value.indexOf('e');
  if(eInd !== -1) {
    const vals = value.split('e');
    const exp = (vals[1].startsWith('+') ? vals[1].slice(1) : vals[1]) || '0';
    let val = vals[0];
    if(val.length === 0 || Number.isNaN(parseInt(val, 10))) {
      throw Error(`Cannot parse ${value}`);
    }
    const dotInd = val.indexOf('.');
    let addZeros = parseInt(exp, 10);
    val = val.replace('.', '');
    if(dotInd !== -1) {
      addZeros -= (val.length - dotInd);
      if(addZeros < 0) {
        return `${val.slice(0, addZeros)}.${val.slice(addZeros)}`;
      }
    }
    return `${val}${'0'.repeat(addZeros)}`;
  }
  return value;
};

const toSafeNumber = (value) => parseSci(value.toString());

const toBN = (num) => BigInt(toSafeNumber(num));

function assertBN(bn1, bn2, msg) {
  bn1 = toSafeNumber(bn1);
  bn2 = toSafeNumber(bn2);
  assert.strictEqual(bn1, bn2, `${msg}. ${bn1} !== ${bn2}`);
}

// Add days to a Date or millisecond timestamp
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function increaseTime(days, start) {
  const now = new Date(start * 1000);
  const later = addDays(now, days).getTime();
  const time = Math.round((later - now.getTime()) / 1000);
  await ethers.provider.send('evm_increaseTime', [time]);
  await ethers.provider.send('evm_mine');
  return start + time;
}

async function assertBalance(Token, address, amount) {
  const balance = await Token.balanceOf(address);
  assertBN(
    balance,
    toBN(amount),
    'Balance incorrect',
  );
}

async function assertGains(sptStaking, address, expected) {
  const gains = await sptStaking.unrealizedGains(address);
  assertBN(gains, expected, 'Shares do no match expected');
}

async function assertStake({ sptToken, sptStaking, signers, stake }) {
  const amountBN = toBN(stake);
  for(let i = 0; i < signers.length; i += 1) {
    const signer = signers[i];
    const originalStake = toBN(await sptStaking.getStake(signer.address));

    await sptToken.connect(signer).approve(sptStaking.address, amountBN);
    await sptStaking.connect(signer).stake(amountBN);
    const staked = await sptStaking.getStake(signer.address);
    assertBN(staked, originalStake + stake, 'Stake does not match input');
    await assertGains(sptStaking, signer.address, 0);
  }
}

async function assertUnstake({ sptToken, sptStaking, sptLocker, signer, expectedTpa }) {
  const initialUserTpa = toBN(await sptToken.balanceOf(signer.address));
  const initialLockerTpa = toBN(await sptToken.balanceOf(sptLocker.address));
  await sptStaking.connect(signer).unstake();
  await assertBalance(sptToken, sptLocker.address, initialLockerTpa + toBN(expectedTpa));

  const latestBlock = await ethers.provider.getBlock('latest');
  await increaseTime(UNSTAKE_DAYS + 1, latestBlock.timestamp);
  await sptLocker.connect(signer).unlock();
  await assertBalance(sptToken, signer.address, initialUserTpa + toBN(expectedTpa));
}

async function assertWithdraw({ sptToken, sptStaking, signer, expectedTpa }) {
  const initialTpa = toBN(await sptToken.balanceOf(signer.address));
  await sptStaking.connect(signer).withdrawDividends();
  await assertBalance(sptToken, signer.address, initialTpa + toBN(expectedTpa));
}

async function assertReinvest({ sptStaking, signer, expectedStake }) {
  await sptStaking.connect(signer).reinvest();
  const stake = toBN(await sptStaking.getStake(signer.address));
  await assertBN(stake, expectedStake);
}

async function postDividend(sptToken, sptStaking, amount) {
  await sptToken.approve(sptStaking.address, amount);
  await sptStaking.postDividend(amount);
}

const shouldRevert = async (action, expectedOutput, message) => {
  try {
    await action;
    assert.strictEqual(false, true, message);
  } catch(error) {
    assert.ok(
      error.message.includes(expectedOutput),
      `Expected: "${expectedOutput}" - (${message}`,
    );
  }
};

module.exports = {
  toBN,
  increaseTime,
  assertBN,
  assertBalance,
  assertStake,
  assertUnstake,
  assertWithdraw,
  assertReinvest,
  assertGains,
  postDividend,
  toSafeNumber,
  shouldRevert,
  UNSTAKE_TIME,
  DAY_S,
};
