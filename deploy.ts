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
export class MMExchange implements Contract {
    readonly address: Address;
    readonly init?: { code: Cell; data: Cell };

    constructor(address: Address, init?: { code: Cell; data: Cell }) {
        this.address = address;
        this.init = init;
    }

    static createFromConfig(config: {
        owner: Address;
        usdtAddress: Address;
        mmAddress: Address;
        mmToUsdtRate: number;
        seqno: number;
    }, code: Cell) {
        const data = beginCell()
            .storeAddress(config.owner)
            .storeAddress(config.usdtAddress)
            .storeAddress(config.mmAddress)
            .storeUint(config.mmToUsdtRate, 32)
            .storeUint(config.seqno, 32)
            .endCell();

        const init = { code, data };
        const address = contractAddress(0, init);
        return new MMExchange(address, init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendWithdrawUSDT(provider: ContractProvider, via: Sender, opts: {
        amount: bigint;
        queryId?: number;
        value?: bigint;
    }) {
        await provider.internal(via, {
            value: opts.value ?? BigInt(200000000), // 0.2 TON by default
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x1234, 32) // op code for withdraw USDT
                .storeUint(opts.queryId ?? 0, 64)
                .storeCoins(opts.amount)
                .endCell(),
        });
    }

    async sendWithdrawMM(provider: ContractProvider, via: Sender, opts: {
        amount: bigint;
        queryId?: number;
        value?: bigint;
    }) {
        await provider.internal(via, {
            value: opts.value ?? BigInt(200000000), // 0.2 TON by default
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x5678, 32) // op code for withdraw MM
                .storeUint(opts.queryId ?? 0, 64)
                .storeCoins(opts.amount)
                .endCell(),
        });
    }

    async sendChangeRate(provider: ContractProvider, via: Sender, opts: {
        newRate: number;
        queryId?: number;
        value?: bigint;
    }) {
        await provider.internal(via, {
            value: opts.value ?? BigInt(200000000), // 0.2 TON by default
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x9abc, 32) // op code for change rate
                .storeUint(opts.queryId ?? 0, 64)
                .storeUint(opts.newRate, 32)
                .endCell(),
        });
    }

    // Get methods
    async getOwnerAddress(provider: ContractProvider) {
        const result = await provider.get('get_owner_address', []);
        return result.stack.readAddress();
    }

    async getUsdtAddress(provider: ContractProvider) {
        const result = await provider.get('get_usdt_address', []);
        return result.stack.readAddress();
    }

    async getMmAddress(provider: ContractProvider) {
        const result = await provider.get('get_mm_address', []);
        return result.stack.readAddress();
    }

    async getMmToUsdtRate(provider: ContractProvider) {
        const result = await provider.get('get_mm_to_usdt_rate', []);
        return result.stack.readNumber();
    }

    async getSeqno(provider: ContractProvider) {
        const result = await provider.get('seqno', []);
        return result.stack.readNumber();
    }
}

// Deploy script
async function deploy() {
    // Load environment variables
    const OWNER_ADDRESS = process.env.OWNER_ADDRESS;
    const USDT_ADDRESS = process.env.USDT_ADDRESS;
    const MM_ADDRESS = process.env.MM_ADDRESS;
    const MM_TO_USDT_RATE = parseInt(process.env.MM_TO_USDT_RATE || '2');
    const MNEMONIC = process.env.MNEMONIC;
    const TON_API_KEY = process.env.TON_API_KEY;

    // Validate environment variables
    if (!OWNER_ADDRESS) throw new Error('OWNER_ADDRESS is not defined in .env file');
    if (!USDT_ADDRESS) throw new Error('USDT_ADDRESS is not defined in .env file');
    if (!MM_ADDRESS) throw new Error('MM_ADDRESS is not defined in .env file');
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
    const compiledContractPath = path.resolve(__dirname, 'mm_exchange.cell');
    if (!fs.existsSync(compiledContractPath)) {
        throw new Error('Compiled contract not found. Run "npm run build" first.');
    }
    
    const cellBuffer = fs.readFileSync(compiledContractPath);
    const code = Cell.fromBoc(cellBuffer)[0];

    // Create contract instance
    const mmExchange = MMExchange.createFromConfig({
        owner: Address.parse(OWNER_ADDRESS),
        usdtAddress: Address.parse(USDT_ADDRESS),
        mmAddress: Address.parse(MM_ADDRESS),
        mmToUsdtRate: MM_TO_USDT_RATE,
        seqno: 0
    }, code);

    // Generate wallet from mnemonic
    const key = await mnemonicToWalletKey(MNEMONIC.split(' '));
    const walletContract = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
    const wallet = client.open(walletContract);

    // Deploy contract
    await mmExchange.sendDeploy(client.provider(mmExchange.address), wallet.sender, BigInt(500000000)); // 0.5 TON

    console.log(`Contract deployed at address: ${mmExchange.address.toString()}`);
}

deploy().catch(console.error);
