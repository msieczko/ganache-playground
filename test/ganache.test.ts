import {MockProvider, solidity} from "ethereum-waffle"
import {constants, Wallet} from "ethers"
import chai, {expect} from "chai"
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)
chai.use(solidity)

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
    provider.off("block", printBlock)
  })

  function printBlock(blockNumber: number) {
    provider.getBlock(blockNumber).then(block => {
      console.log(`\nBlock #${block.number}`)
      console.log(`Transactions = [${block.transactions.join(", ")}]`)
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

    // RESULT:
    // Block #0
    // Transactions = []
    //
    // Block #1
    // Transactions = [0x64f70d7baed73fc87f116ba1e944fc0da6132c5812b9c0185c4d98f5df2a62ba, 0x4d2f3ad5434b328c9b24ad69b1ec22b37f84d3b09f0197d5bff84271f0932a48, 0xb41d2c28841353389dd9e6eda69ce3e51e1c705acd8e7b9d749c132d3d6ed0e9]
    //
    // Block #2
    // Transactions = []
    //
    // Block #3
    // Transactions = []
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

    // RESULT:
    // Block #0
    // Transactions = []
    //
    // Block #1
    // Transactions = [0x64f70d7baed73fc87f116ba1e944fc0da6132c5812b9c0185c4d98f5df2a62ba, 0xc8f2f098d58526fa2bceda6a8e14990cd1d7b7e25b31b8094e11a8e27e693d3f]
    //
    // Block #2
    // Transactions = [0xb41d2c28841353389dd9e6eda69ce3e51e1c705acd8e7b9d749c132d3d6ed0e9]
    //
    // Block #3
    // Transactions = []
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

    // RESULT:
    // Block #0
    // Transactions = []
    //
    // Block #1
    // Transactions = []
    //
    // Block #2
    // Transactions = []
  }).timeout(0)

  it("does not allow to call eth_getBalance in the context of 'pending' block", async () => {
    const initialBalance = await walletB.getBalance()
    await walletA.sendTransaction({
      to: walletB.address,
      nonce: 0,
      value: 100
    })
    await sleep(500)
    const balance = await provider.getBalance(walletB.address, 'pending')
    await expect(provider.getBalance(walletB.address, 1))
      .to.be.rejectedWith("'blocks' index out of range: index 1; length: 1")
    expect(balance).to.not.eq(initialBalance.add(100))
  }).timeout(0)
})
