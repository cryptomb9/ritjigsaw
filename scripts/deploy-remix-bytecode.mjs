import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const DEFAULT_BYTECODE_PATH = "contracts/PuzzleCompletion.bytecode.txt";
const bytecodePath = process.argv[2] ?? DEFAULT_BYTECODE_PATH;

const ritual = defineChain({
  id: 1979,
  name: "Ritual",
  nativeCurrency: {
    name: "Ritual",
    symbol: "RITUAL",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.ritualfoundation.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Ritual Explorer",
      url: "https://explorer.ritualfoundation.org",
    },
  },
});

function readDotEnvLocal() {
  const envPath = resolve(".env.local");

  if (!existsSync(envPath)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        if (separatorIndex === -1) {
          return [line, ""];
        }

        return [
          line.slice(0, separatorIndex),
          line.slice(separatorIndex + 1).replace(/^["']|["']$/g, ""),
        ];
      }),
  );
}

function normalizeBytecode(raw) {
  const prefixedMatch = raw.match(/0x[0-9a-fA-F]{64,}/);

  if (prefixedMatch) {
    return prefixedMatch[0];
  }

  const bareMatches = raw.match(/[0-9a-fA-F]{64,}/g);
  const bytecode = bareMatches?.sort((a, b) => b.length - a.length)[0];

  if (!bytecode) {
    throw new Error(
      `No bytecode found in ${bytecodePath}. Paste the full Remix contract creation bytecode there, compiled with EVM version paris.`,
    );
  }

  return `0x${bytecode}`;
}

function normalizePrivateKey(rawPrivateKey) {
  const trimmed = rawPrivateKey.trim();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

const envLocal = readDotEnvLocal();
const privateKey = process.env.PRIVATE_KEY ?? envLocal.PRIVATE_KEY;
const rpcUrl =
  process.env.RITUAL_RPC_URL ??
  envLocal.RITUAL_RPC_URL ??
  envLocal.VITE_RITUAL_RPC_URL ??
  ritual.rpcUrls.default.http[0];

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY in .env.local or process env.");
}

if (!existsSync(bytecodePath)) {
  throw new Error(
    `Missing ${bytecodePath}. Compile PuzzleCompletion.sol in Remix with EVM version paris, copy the contract bytecode, and paste it into that file.`,
  );
}

if (
  rpcUrl.includes("ritualfoundation.org") &&
  process.env.RITUAL_STRICT_TLS !== "true"
) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const account = privateKeyToAccount(normalizePrivateKey(privateKey));
const bytecode = normalizeBytecode(readFileSync(bytecodePath, "utf8"));
const transport = http(rpcUrl);
const publicClient = createPublicClient({
  chain: ritual,
  transport,
});
const walletClient = createWalletClient({
  account,
  chain: ritual,
  transport,
});

console.log(`Deploying from ${account.address}`);
console.log(`RPC: ${rpcUrl}`);

const gasPrice = await publicClient.getGasPrice();
const feeFields = {
  maxFeePerGas: gasPrice * 2n,
  maxPriorityFeePerGas: gasPrice,
  type: "eip1559",
};

console.log(`Transaction type: ${feeFields.type}`);

const hash = await walletClient.sendTransaction({
  account,
  data: bytecode,
  ...feeFields,
});

console.log(`Deploy tx: ${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({
  hash,
  pollingInterval: 2_000,
});

if (receipt.status !== "success" || !receipt.contractAddress) {
  throw new Error(`Deployment failed. Transaction hash: ${hash}`);
}

console.log(`Contract address: ${receipt.contractAddress}`);
console.log(`Explorer: https://explorer.ritualfoundation.org/tx/${hash}`);
