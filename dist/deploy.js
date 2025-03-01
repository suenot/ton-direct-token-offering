"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@ton/core");
const crypto_1 = require("@ton/crypto");
const ton_1 = require("@ton/ton");
const dotenv = __importStar(require("dotenv"));
const fs_1 = require("fs");
dotenv.config();
// Contract implementation
class DirectTokenOffering {
    constructor(address, init) {
        this.address = address;
        this.init = init;
    }
    static createFromConfig(ownerAddress, usdtAddress, mmAddress, mmToUsdtRate, code) {
        const data = (0, core_1.beginCell)()
            .storeAddress(ownerAddress)
            .storeAddress(usdtAddress)
            .storeAddress(mmAddress)
            .storeUint(mmToUsdtRate, 32)
            .storeUint(0, 32) // seqno
            .endCell();
        const init = { code, data };
        const address = (0, core_1.contractAddress)(0, init);
        return new DirectTokenOffering(address, init);
    }
    // Contract methods
    async sendDeploy(provider, via, value) {
        await provider.internal(via, {
            value,
            sendMode: core_1.SendMode.PAY_GAS_SEPARATELY,
            body: (0, core_1.beginCell)().endCell(),
        });
    }
}
async function main() {
    try {
        // Check environment variables
        if (!process.env.OWNER_ADDRESS)
            throw new Error('OWNER_ADDRESS is not defined in .env');
        if (!process.env.USDT_ADDRESS)
            throw new Error('USDT_ADDRESS is not defined in .env');
        if (!process.env.PROJECT_TOKEN_ADDRESS)
            throw new Error('PROJECT_TOKEN_ADDRESS is not defined in .env');
        if (!process.env.PROJECT_TOKEN_TO_USDT_RATE)
            throw new Error('PROJECT_TOKEN_TO_USDT_RATE is not defined in .env');
        if (!process.env.MNEMONIC)
            throw new Error('MNEMONIC is not defined in .env');
        // Parse addresses and parameters
        const ownerAddress = core_1.Address.parse(process.env.OWNER_ADDRESS);
        const usdtAddress = core_1.Address.parse(process.env.USDT_ADDRESS);
        const projectTokenAddress = core_1.Address.parse(process.env.PROJECT_TOKEN_ADDRESS);
        const projectTokenToUsdtRate = Number(process.env.PROJECT_TOKEN_TO_USDT_RATE);
        // Load the compiled contract
        const contractCode = core_1.Cell.fromBoc((0, fs_1.readFileSync)('direct_token_offering.fc.cell'))[0];
        // Create an instance of the contract
        const contract = DirectTokenOffering.createFromConfig(ownerAddress, usdtAddress, projectTokenAddress, projectTokenToUsdtRate, contractCode);
        console.log('Contract address:', contract.address.toString());
        // Initialize TonClient
        const client = new ton_1.TonClient({
            endpoint: process.env.TON_API_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC',
            apiKey: process.env.TON_API_KEY
        });
        // Prepare the wallet for deployment
        const mnemonic = process.env.MNEMONIC.split(' ');
        const keyPair = await (0, crypto_1.mnemonicToPrivateKey)(mnemonic);
        // Create wallet from private key
        const wallet = ton_1.WalletContractV4.create({
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
        }
        else {
            console.log('Contract deployment failed. Current state:', newContractInfo.state);
        }
    }
    catch (error) {
        console.error('Error during deployment:', error);
        process.exit(1);
    }
}
// Run the deployment
main();
