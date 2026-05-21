# Ritual block puzzle

A drag-and-drop jigsaw puzzle game for Ritual Chain. Players solve the puzzle in the browser, then submit one transaction that records their completion proof, move count, time, and best score on-chain.

## How It Works

- The puzzle state runs client-side, so many people can play at the same time without a backend queue.
- The smart contract stores only score data keyed by a frontend puzzle hash.
- Points are stored on-chain. A player's lifetime total increases only when they improve their best score on a puzzle.
- The UI displays the top 30 leaderboard entries from the contract.
- The frontend only calls the contract after the board is complete.
- The default deployment target is Ritual Chain, chain ID `1979`.

This is intentionally not using Ritual async precompiles for the main game loop. A jigsaw completion is a normal EVM state write, which keeps the UX fast and avoids async executor locks.

## Scoring

The contract uses the same deterministic score formula as the frontend:

```text
score = max(1, rows * cols * 1000 - secondsTaken * 10 - moves * 25)
```

If a player solves the same puzzle again, only a better score updates their stored completion. Their lifetime points increase by the improvement delta, not by the full score again.

## Project Structure

```text
ritual-jigsaw/
  contracts/
    src/PuzzleCompletion.sol
    script/Deploy.s.sol
  public/puzzles/
    ritual-placeholder.svg
  src/
    components/
    lib/
    abi/
```

## Local Frontend

```bash
npm install
npm run dev
```

Open the local URL Vite prints.

## Environment

For frontend development and Vercel, only `VITE_*` values are needed by the app:

```bash
VITE_RITUAL_RPC_URL=https://rpc.ritualfoundation.org
VITE_PUZZLE_CONTRACT_ADDRESS=0xYourDeployedPuzzleCompletionContract
```

Until `VITE_PUZZLE_CONTRACT_ADDRESS` is set, the puzzle can still be played but on-chain submission stays disabled.

The contract address and RPC URL are public. The deployer `PRIVATE_KEY` is not a frontend value and must not be added to Vercel. Keep it local or in a deployment-only secret store.

For Vercel, set these in Project Settings -> Environment Variables:

```text
VITE_RITUAL_RPC_URL=https://rpc.ritualfoundation.org
VITE_PUZZLE_CONTRACT_ADDRESS=0xYourDeployedPuzzleCompletionContract
```

The currently deployed score contract is:

```text
VITE_PUZZLE_CONTRACT_ADDRESS=0x9524222bc21b5d90172b3e4c0c86abedfcb8d9d0
```

`.env.local` is ignored so you do not accidentally commit your personal local settings. If you deploy with GitHub Pages and need the public address committed, copy `.env.production.example` to `.env.production`, replace the placeholder with the real CA, and commit that file after the contract is deployed.

## Contract Deployment

Install Foundry and forge-std first if you do not have them:

```bash
cd contracts
forge install foundry-rs/forge-std
```

Deploy to Ritual:

```bash
cd contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.ritualfoundation.org \
  --broadcast \
  -vvvv
```

The Foundry config pins `evm_version = "paris"` so the bytecode stays compatible
with Ritual's current EVM target.

If Remix deployment fails, use Remix only for compiling. Set the Remix EVM
version to `paris`, then copy the contract creation bytecode into
`contracts/PuzzleCompletion.bytecode.txt`, then deploy from this project:

```bash
npm run deploy:bytecode
```

That helper sends an EIP-1559 deployment transaction with explicit fee fields.

Then place the deployed address in `.env.local`:

```bash
VITE_PUZZLE_CONTRACT_ADDRESS=0xYourDeployedPuzzleCompletionContract
```

If she is deploying, she should use her wallet/private key for the deployment. The useful contract is `contracts/src/PuzzleCompletion.sol`; `contracts/script/Deploy.s.sol` is only the Foundry helper that deploys it.

## Add Or Replace Puzzle Images

Images are frontend-only. Players can paste a public `https://...` or `ipfs://...` image URI directly in the puzzle picker, or you can bundle images by putting them in `public/puzzles/`.

Bundled images are auto-discovered at build time by:

```bash
npm run generate:puzzles
```

`npm run dev`, `npm run build`, and `npm run typecheck` run that generator automatically. To add a bundled puzzle, place the image in `public/puzzles/` and redeploy. No contract registration is needed.

Supported bundled image extensions are `.gif`, `.jpeg`, `.jpg`, `.png`, `.svg`, and `.webp`. New images default to a `4x4` grid. If you want a different grid, include it in the file name, for example `city-3x3.jpg` or `poster-5x4.png`.

The game slices images in the browser with CSS. Each piece stores its original `row` and `col`; the visible crop is made with `background-size` and `background-position`. A board slot is correct when the piece's original `row` and `col` match the slot's `row` and `col`.

There is no on-chain image registration. The contract only receives the puzzle hash, grid size, move count, time, and completion hash after the frontend has confirmed the board is solved.

## Verification

Frontend:

```bash
npm run build
```

Contracts:

```bash
cd contracts
forge build
```

Contract source verification on Ritual uses the custom verifier URL:

```bash
forge verify-contract \
  --chain 1979 \
  --watch \
  --verifier custom \
  --verifier-url https://rpc.ritualfoundation.org/api/verify \
  --verifier-api-key unused \
  0xYourDeployedPuzzleCompletionContract \
  src/PuzzleCompletion.sol:PuzzleCompletion
```

## Scaling Notes

This architecture scales better than a bot-style backend because the active gameplay does not touch a server. Each player only sends one Ritual transaction after solving. The contract uses constant-size writes per player and emits events for indexing leaderboards later.

For real prize money or high-stakes rewards, add stronger anti-cheat before paying winners. The current proof is good for hackathon or demo completion logging, but a direct contract caller can still submit the known layout hash.
