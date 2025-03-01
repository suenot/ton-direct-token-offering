# TON Direct Token Offering (DTO) in UDST

A smart contract for the TON blockchain that facilitates direct token offerings at a fixed price. This contract allows token issuers to sell their tokens directly to investors without intermediaries, operating on a "first come, first served" basis.

## Features

- Exchange USDT for project tokens at a fixed rate
- Owner can withdraw accumulated USDT
- Owner can withdraw remaining project tokens
- Owner can change the exchange rate
- Minimum transaction amount to prevent spam
- Security checks to ensure proper operation

## How It Works

1. The contract owner deploys the contract with the following parameters:
   - Owner wallet address
   - USDT token address
   - Project token address
   - Exchange rate (how many project tokens per 1 USDT)

2. The owner sends project tokens to the contract

3. Investors send USDT to the contract and automatically receive project tokens at the configured rate

4. The owner can withdraw accumulated USDT at any time

## Setup

1. Clone this repository
2. Install dependencies:
```bash
npm install
```
3. Create a `.env` file based on the `.env.example` template
4. Fill in your environment variables in the `.env` file

## Deployment

To deploy the contract to the TON blockchain:

```bash
npx ts-node deploy.ts
```

## Usage

### For Investors

Investors can participate in the token offering by sending USDT to the contract address. The minimum amount is 10 USDT.

### For Contract Owner

The contract owner can:

1. Withdraw accumulated USDT tokens:
```typescript
await dto.sendWithdrawUSDT(provider, wallet.sender, {
  amount: BigInt(1000000000) // Amount in nanoUSDT (1 USDT = 1,000,000,000 nanoUSDT)
});
```

2. Withdraw remaining project tokens:
```typescript
await dto.sendWithdrawProjectToken(provider, wallet.sender, {
  amount: BigInt(1000000000) // Amount in nano tokens (1 token = 1,000,000,000 nano)
});
```

3. Change the exchange rate:
```typescript
await dto.sendChangeRate(provider, wallet.sender, {
  newRate: 3 // New rate: 1 USDT = 3 project tokens
});
```

### Maintenance Requirements

The contract requires a balance of TON coins to function properly. TON is needed to pay for gas fees when processing transactions and sending tokens. Without sufficient TON, the contract will not be able to execute operations even if it has enough USDT or project tokens.

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
- Only the owner can withdraw accumulated USDT tokens or remaining project tokens
- Only the owner can change the exchange rate
- The contract checks if it has enough project tokens to fulfill the exchange
- The contract enforces a minimum transaction amount (10 USDT) to prevent gas drain attacks
- All sensitive operations are protected by sender address verification

## License

MIT
