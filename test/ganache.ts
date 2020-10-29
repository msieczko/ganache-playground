import {MockProvider} from "ethereum-waffle"
import {constants, Wallet} from "ethers"
import chai, {expect} from "chai"
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

describe('Ganache', () => {
  let provider: MockProvider
  let walletA: Wallet
  let walletB: Wallet

  beforeEach(() => {
    provider = new MockProvider({ganacheOptions: {gasLimit: 6_000_000, blockTime: 1}});
    [walletA, walletB] = provider.getWallets()
    provider.on("block", printBlock)
  })

  afterEach(async () => {
    await sleep(1_000)
    provider.off("block", printBlock)
  })

  function printBlock(blockNumber: number) {
    provider.getBlock(blockNumber).then(block => {
      console.log(`Block #${block.number}`)
      console.log(`Transactions = [${block.transactions.join(", ")}]\n`)
    })
  }

  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  it("can put three transactions in the same block if they don't exceed block gas limit", async () => {
    await walletA.sendTransaction({
      to: walletB.address,
      nonce: 0,
      gasLimit: 2_000_000,
    })
    await walletA.sendTransaction({
      to: walletB.address,
      nonce: 1,
      gasLimit: 2_000_000,
    })
    await walletA.sendTransaction({
      to: walletB.address,
      nonce: 2,
      gasLimit: 2_000_000,
    })

    await sleep(4_000)
  }).timeout(0)

  it('separates the transactions into two blocks if they exceed block gas limit', async () => {
    await walletA.sendTransaction({
      to: walletB.address,
      nonce: 0,
      gasLimit: 2_000_000,
    })
    await walletA.sendTransaction({
      to: walletB.address,
      nonce: 1,
      gasLimit: 2_000_001,
    })
    await walletA.sendTransaction({
      to: walletB.address,
      nonce: 2,
      gasLimit: 2_000_000,
    })

    await sleep(4_000)
  }).timeout(0)

  it('does not handle transaction queueing', async () => {
    await walletA.sendTransaction({
      to: walletB.address,
      nonce: 0,
    })
    await walletA.sendTransaction({
      to: walletB.address,
      nonce: 1,
    })
    await expect(
      walletA.sendTransaction({
        to: walletB.address,
        nonce: 3,
        gasLimit: 2_000_000,
      })
    ).to.be.rejectedWith("the tx doesn't have the correct nonce. account has nonce of: 2 tx has nonce of: 3")
  })

  it('will not mine any pending transactions in a new block if one of them fails', async () => {
    const initialBalance = await walletA.getBalance()
    await walletB.sendTransaction({
      to: constants.AddressZero,
      value: 1234
    })
    await walletA.sendTransaction({
      to: walletB.address,
      nonce: 0,
      value: initialBalance.mul(3).div(4)
    })
    await walletA.sendTransaction({
      to: walletB.address,
      nonce: 1,
      value: initialBalance.mul(3).div(4)
    })

    await sleep(4_000)
  }).timeout(0)
})
