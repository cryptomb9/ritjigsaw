# Contract Deployment

The useful contract is:

```text
contracts/src/PuzzleCompletion.sol
```

This version does not register images or puzzle metadata. The frontend owns the image list and only calls the contract after the board is solved. The contract records:

```text
submitScore(puzzleHash, rows, cols, moves, secondsTaken, completionHash)
```

## Remix Compile, Project Deploy

Remix can compile the contract, but set the EVM version to `paris` so the
bytecode does not include newer opcodes Ritual may reject. Compile
`PuzzleCompletion.sol`, copy the contract creation bytecode, then paste it into:

```text
contracts/PuzzleCompletion.bytecode.txt
```

Deploy it from this project with an EIP-1559 transaction:

```bash
npm run deploy:bytecode
```

After deployment, copy the printed contract address into `.env.local` as
`VITE_PUZZLE_CONTRACT_ADDRESS`, then restart the frontend dev server.

For Vercel, set only the public frontend values in Project Settings ->
Environment Variables:

```text
VITE_RITUAL_RPC_URL=https://rpc.ritualfoundation.org
VITE_PUZZLE_CONTRACT_ADDRESS=0xYourDeployedPuzzleCompletionContract
```

Do not put `PRIVATE_KEY` in Vercel for this frontend.

## Foundry Deploy

If deploying with Foundry, the local `foundry.toml` already pins
`evm_version = "paris"`:

```bash
cd contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.ritualfoundation.org \
  --broadcast \
  -vvvv
```

After deployment, copy the new contract address into the frontend environment as `VITE_PUZZLE_CONTRACT_ADDRESS`.

The previous deployed registration contract is not compatible with this score-only ABI.
