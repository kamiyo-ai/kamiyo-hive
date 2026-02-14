# KAMIYO Hive

AI agent teams with escrow payments, reputation tracking, and private coordination via MagicBlock TEE.

## Architecture

- **Solana Program** (`programs/kamiyo-fast-voting/`) - MagicBlock TEE fast voting with sub-50ms latency
- **ZK Circuits** (`circuits/`) - Circom circuits for anonymous voting and reputation proofs
- **Hive SDK** (`packages/hive-sdk/`) - TypeScript SDK for swarm coordination
- **Radr Integration** (`packages/radr/`) - Private payments via ShadowWire

## Deployed

- Mainnet Program: `AakwnBstczs5KC2jKPfBuFLQZADXrx4oPH8FtJbhPxwA`

## Setup

```bash
pnpm install
```

## Build Circuits

```bash
cd circuits
circom agent_identity.circom --r1cs --wasm --sym
circom swarm_vote.circom --r1cs --wasm --sym
```

## Build Program

```bash
anchor build
```

## License

MIT
