import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

// Contract implementation
class DirectTokenOffering implements Contract {
  readonly address: Address;
  readonly init?: { code: Cell; data: Cell };

  constructor(address: Address, init?: { code: Cell; data: Cell }) {
    this.address = address;
    this.init = init;
  }

  static createFromConfig(
    ownerAddress: Address,
    usdtAddress: Address,
    mmAddress: Address,
    mmToUsdtRate: number,
    code: Cell
  ) {
    const data = beginCell()
      .storeAddress(ownerAddress)
      .storeAddress(usdtAddress)
      .storeAddress(mmAddress)
      .storeUint(mmToUsdtRate, 32)
      .storeUint(0, 32) // seqno
      .endCell();

    const init = { code, data };
    const address = contractAddress(0, init);
    return new DirectTokenOffering(address, init);
  }

  // Contract methods
  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }
}

async function main() {
  try {
    // Check environment variables
    if (!process.env.OWNER_ADDRESS) throw new Error('OWNER_ADDRESS is not defined in .env');
    if (!process.env.USDT_ADDRESS) throw new Error('USDT_ADDRESS is not defined in .env');
    if (!process.env.PROJECT_TOKEN_ADDRESS) throw new Error('PROJECT_TOKEN_ADDRESS is not defined in .env');
    if (!process.env.PROJECT_TOKEN_TO_USDT_RATE) throw new Error('PROJECT_TOKEN_TO_USDT_RATE is not defined in .env');
    if (!process.env.MNEMONIC) throw new Error('MNEMONIC is not defined in .env');
    
    // Parse addresses and parameters
    const ownerAddress = Address.parse(process.env.OWNER_ADDRESS);
    const usdtAddress = Address.parse(process.env.USDT_ADDRESS);
    const projectTokenAddress = Address.parse(process.env.PROJECT_TOKEN_ADDRESS);
    const projectTokenToUsdtRate = Number(process.env.PROJECT_TOKEN_TO_USDT_RATE);
    
    // Load the compiled contract
    const contractCode = Cell.fromBoc(readFileSync('direct_token_offering.fc.cell'))[0];
    
    // Create an instance of the contract
    const contract = DirectTokenOffering.createFromConfig(
      ownerAddress,
      usdtAddress,
      projectTokenAddress,
      projectTokenToUsdtRate,
      contractCode
    );
    
    console.log('Contract address:', contract.address.toString());
    
    // Initialize TonClient
    const client = new TonClient({
      endpoint: process.env.TON_API_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY
    });
    
    // Prepare the wallet for deployment
    const mnemonic = process.env.MNEMONIC.split(' ');
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    
    // Create wallet from private key
    const wallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0
    });
    const walletContract = client.open(wallet);
    const walletSender = walletContract.sender(keyPair.secretKey);
    
    console.log('Deployer wallet address:', wallet.address.toString());
    
    // Check if the contract is already deployed
    const contractInfo = await client.getContractState(contract.address);
    if (contractInfo.state === 'active') {
      console.log('Contract is already deployed!');
      process.exit(0);
    }
    
    // Deploy the contract
    console.log('Deploying contract...');
    
    // Use our contract's deploy method
    await contract.sendDeploy(client.provider(contract.address), walletSender, BigInt(500000000)); // 0.5 TON
    
    console.log('Waiting for deployment to complete...');
    
    // Wait for the transaction to complete
    await new Promise((resolve) => setTimeout(resolve, 10000));
    
    // Check if the contract is now deployed
    const newContractInfo = await client.getContractState(contract.address);
    if (newContractInfo.state === 'active') {
      console.log('Contract successfully deployed!');
    } else {
      console.log('Contract deployment failed. Current state:', newContractInfo.state);
    }
    
  } catch (error) {
    console.error('Error during deployment:', error);
    process.exit(1);
  }
}

// Run the deployment
main();
