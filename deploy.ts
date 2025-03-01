import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from 'ton-core';
import { mnemonicToWalletKey } from 'ton-crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';
import { getHttpEndpoint } from '@orbs-network/ton-access';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Contract implementation
class DirectTokenOffering implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(
    owner_address: Address,
    usdt_address: Address,
    project_token_address: Address,
    project_token_to_usdt_rate: number,
    seqno: number,
    code: Cell
  ) {
    const data = beginCell()
      .storeAddress(owner_address)
      .storeAddress(usdt_address)
      .storeAddress(project_token_address)
      .storeUint(project_token_to_usdt_rate, 32)
      .storeUint(seqno, 32)
      .endCell();
    
    const init = { code, data };
    const address = contractAddress(0, init);
    
    return new DirectTokenOffering(address, init);
  }

  async sendDeploy(provider: ContractProvider, sender: Sender, value: bigint) {
    await provider.internal(sender, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendWithdrawUSDT(provider: ContractProvider, sender: Sender, params: { amount: bigint }) {
    const { amount } = params;
    
    await provider.internal(sender, {
      value: BigInt(200000000), // 0.2 TON for gas
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x1234, 32) // op code for withdraw USDT
        .storeUint(0, 64) // query id
        .storeCoins(amount) // amount to withdraw
        .endCell(),
    });
  }

  async sendWithdrawProjectToken(provider: ContractProvider, sender: Sender, params: { amount: bigint }) {
    const { amount } = params;
    
    await provider.internal(sender, {
      value: BigInt(200000000), // 0.2 TON for gas
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x5678, 32) // op code for withdraw project tokens
        .storeUint(0, 64) // query id
        .storeCoins(amount) // amount to withdraw
        .endCell(),
    });
  }

  async sendChangeRate(provider: ContractProvider, sender: Sender, params: { newRate: number }) {
    const { newRate } = params;
    
    await provider.internal(sender, {
      value: BigInt(100000000), // 0.1 TON for gas
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x9abc, 32) // op code for change rate
        .storeUint(0, 64) // query id
        .storeUint(newRate, 32) // new rate
        .endCell(),
    });
  }
}

// Deploy script
async function deploy() {
    // Load environment variables
    const OWNER_ADDRESS = process.env.OWNER_ADDRESS;
    const USDT_ADDRESS = process.env.USDT_ADDRESS;
    const PROJECT_TOKEN_ADDRESS = process.env.PROJECT_TOKEN_ADDRESS;
    const PROJECT_TOKEN_TO_USDT_RATE = parseInt(process.env.PROJECT_TOKEN_TO_USDT_RATE || '2');
    const MNEMONIC = process.env.MNEMONIC;
    const TON_API_KEY = process.env.TON_API_KEY;

    // Validate environment variables
    if (!OWNER_ADDRESS) throw new Error('OWNER_ADDRESS is not defined in .env file');
    if (!USDT_ADDRESS) throw new Error('USDT_ADDRESS is not defined in .env file');
    if (!PROJECT_TOKEN_ADDRESS) throw new Error('PROJECT_TOKEN_ADDRESS is not defined in .env file');
    if (!MNEMONIC) throw new Error('MNEMONIC is not defined in .env file');

    // Connect to TON
    // Try to use TON Access first (decentralized), fallback to toncenter if API key is provided
    let endpoint;
    try {
        endpoint = await getHttpEndpoint();
        console.log('Using TON Access endpoint:', endpoint);
    } catch (error) {
        if (!TON_API_KEY) throw new Error('Failed to get TON Access endpoint and TON_API_KEY is not defined in .env file');
        endpoint = 'https://toncenter.com/api/v2/jsonRPC';
        console.log('Using toncenter endpoint with API key');
    }

    const client = new TonClient({
        endpoint: endpoint,
        apiKey: TON_API_KEY
    });

    // Load contract code
    const contractCode = fs.readFileSync(
        path.resolve(__dirname, 'direct_token_offering.fc.cell'),
        'binary'
    );
    const code = Cell.fromBoc(Buffer.from(contractCode, 'binary'))[0];

    // Create wallet
    const key = await mnemonicToWalletKey(MNEMONIC.split(' '));
    const wallet = WalletContractV4.create({ 
        publicKey: key.publicKey, 
        workchain: 0 
    });
    const walletContract = client.open(wallet);
    const walletSender = walletContract.sender(key.secretKey);

    // Create contract instance
    const dto = DirectTokenOffering.createFromConfig(
        Address.parse(OWNER_ADDRESS),
        Address.parse(USDT_ADDRESS),
        Address.parse(PROJECT_TOKEN_ADDRESS),
        PROJECT_TOKEN_TO_USDT_RATE,
        0, // initial seqno
        code
    );

    // Print contract address
    console.log('Contract address:', dto.address.toString());

    // Check if contract is already deployed
    const contractBalance = await client.getBalance(dto.address);
    console.log('Contract balance:', contractBalance);
    
    if (contractBalance > 0) {
        console.log('Contract is already deployed');
        return;
    }

    // Deploy contract
    await dto.sendDeploy(client.provider(dto.address), walletSender, BigInt(500000000)); // 0.5 TON
    console.log('Contract deployed successfully');
}

deploy().catch(console.error);
