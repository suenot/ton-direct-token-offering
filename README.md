# MM Exchange TON Contract

This is a TON blockchain smart contract that exchanges USDT tokens for MM (Marketmaker) tokens at a fixed rate.

## Features

- Accepts USDT tokens and sends MM tokens in return at a configurable rate (default: 1 USDT = 2 MM)
- Handles cases where the contract doesn't have enough MM tokens to fulfill the exchange
- Allows the owner to withdraw accumulated USDT tokens
- Allows the owner to withdraw remaining MM tokens
- Allows the owner to change the exchange rate at any time

## Contract Structure

The contract is written in FunC and consists of the following components:

- Storage for owner address, USDT token address, MM token address, exchange rate, and sequence number
- Methods for receiving USDT tokens and sending MM tokens in return
- Methods for the owner to withdraw accumulated USDT tokens
- Methods for the owner to withdraw remaining MM tokens
- Methods for the owner to change the exchange rate
- Get methods for retrieving contract data

## Deployment

To deploy the contract, follow these steps:

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on the `.env.example` template:
```bash
cp .env.example .env
```

3. Update the `.env` file with your specific values:
   - `OWNER_ADDRESS`: Your wallet address
   - `USDT_ADDRESS`: The address of the USDT token contract in TON
   - `MM_ADDRESS`: The address of the MM token contract in TON
   - `MM_TO_USDT_RATE`: The exchange rate (default: 2, meaning 1 USDT = 2 MM)
   - `MNEMONIC`: Your wallet's mnemonic phrase
   - `TON_API_KEY`: Your TON API key

4. Compile and deploy the contract:
```bash
npm run deploy
```

## Usage

### For Users

Users can exchange USDT for MM tokens by sending USDT to the contract. The contract will automatically send MM tokens back to the user at the configured rate.

### For Contract Owner

The contract owner can:

1. Withdraw accumulated USDT tokens:
```typescript
await mmExchange.sendWithdrawUSDT(provider, wallet.sender, {
  amount: BigInt(1000000000) // Amount in nanoUSDT (1 USDT = 1,000,000,000 nanoUSDT)
});
```

2. Withdraw remaining MM tokens:
```typescript
await mmExchange.sendWithdrawMM(provider, wallet.sender, {
  amount: BigInt(1000000000) // Amount in nanoMM (1 MM = 1,000,000,000 nanoMM)
});
```

3. Change the exchange rate:
```typescript
await mmExchange.sendChangeRate(provider, wallet.sender, {
  newRate: 3 // New rate: 1 USDT = 3 MM
});
```

### Maintenance Requirements

The contract requires a balance of TON coins to function properly. TON is needed to pay for gas fees when processing transactions and sending tokens. Without sufficient TON, the contract will not be able to execute operations even if it has enough USDT or MM tokens.

1. Initial TON balance:
   - The contract is deployed with 0.5 TON
   - This is sufficient for initial operations

2. Regular maintenance:
   - Monitor the TON balance of the contract regularly
   - When the balance falls below ~0.2 TON, replenish it by sending additional TON
   - Recommended to maintain at least 1 TON for stable operation

3. Replenishing TON:
   - Simply send TON to the contract address from any wallet
   - No special function call is needed, a plain transfer is sufficient

Failure to maintain adequate TON balance may result in the contract being unable to process exchanges or return tokens to users.

## Security Considerations

- The contract only accepts token transfers from the configured USDT token contract
- Only the owner can withdraw accumulated USDT tokens or remaining MM tokens
- Only the owner can change the exchange rate
- The contract checks if it has enough MM tokens to fulfill the exchange
- The contract enforces a minimum transaction amount (10 USDT) to prevent gas drain attacks
- All sensitive operations are protected by sender address verification

## License

This project is licensed under the MIT License.
