import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, http, parseEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

function readDotEnvLocal() {
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
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

function normalizePrivateKey(privateKey) {
  return privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
}

const envLocal = readDotEnvLocal();
const rpcUrl =
  process.env.RITUAL_RPC_URL ??
  envLocal.RITUAL_RPC_URL ??
  envLocal.VITE_RITUAL_RPC_URL ??
  "https://rpc.ritualfoundation.org";
const privateKey = process.env.PRIVATE_KEY ?? envLocal.PRIVATE_KEY;

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY in .env.local or process env.");
}

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
      http: [rpcUrl],
    },
  },
});

const sender = privateKeyToAccount(normalizePrivateKey(privateKey));
const receiver = privateKeyToAccount(generatePrivateKey());
const transport = http(rpcUrl);
const publicClient = createPublicClient({
  chain: ritual,
  transport,
});
const walletClient = createWalletClient({
  account: sender,
  chain: ritual,
  transport,
});

console.log(`Sender: ${sender.address}`);
console.log(`Receiver: ${receiver.address}`);
console.log(`RPC: ${rpcUrl}`);

const chainId = await publicClient.getChainId();
console.log(`RPC chainId: ${chainId}`);

const gasPrice = await publicClient.getGasPrice();
console.log(`Gas price: ${gasPrice.toString()}`);

const transactionType = process.env.TEST_TX_TYPE ?? "eip1559";
const transaction = {
  account: sender,
  to: receiver.address,
  value: parseEther("0.01"),
  gas: 21_000n,
};

if (transactionType === "eip1559") {
  transaction.type = "eip1559";
  transaction.maxFeePerGas = gasPrice * 2n;
  transaction.maxPriorityFeePerGas = gasPrice;
} else {
  transaction.type = "legacy";
  transaction.gasPrice = gasPrice;
}

console.log(`Transaction type: ${transaction.type}`);

const hash = await walletClient.sendTransaction(transaction);

console.log(`Tx hash: ${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({
  hash,
  pollingInterval: 2_000,
});

console.log(`Receipt status: ${receipt.status}`);
console.log(`Block: ${receipt.blockNumber.toString()}`);
