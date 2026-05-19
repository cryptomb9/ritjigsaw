import {
  createPublicClient,
  defineChain,
  encodeFunctionData,
  formatEther,
  getAddress,
  http,
  isAddress,
  toHex,
  type Address,
  type EIP1193Provider,
  type Hash,
} from "viem";
import { puzzleCompletionAbi } from "../abi/PuzzleCompletion";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const RITUAL_CHAIN_ID_HEX = "0x7bb";
const RITUAL_EXPLORER_URL = "https://explorer.ritualfoundation.org";
const DEFAULT_PUZZLE_CONTRACT_ADDRESS = "0x9524222bc21b5d90172b3e4c0c86abedfcb8d9d0";

export const RITUAL_RPC_URL =
  import.meta.env.VITE_RITUAL_RPC_URL ?? "https://rpc.ritualfoundation.org";

export const ritualChain = defineChain({
  id: 1979,
  name: "RITUAL TESTNET",
  nativeCurrency: {
    decimals: 18,
    name: "RITUAL",
    symbol: "RITUAL",
  },
  rpcUrls: {
    default: {
      http: [RITUAL_RPC_URL],
      webSocket: ["wss://rpc.ritualfoundation.org/ws"],
    },
  },
  blockExplorers: {
    default: {
      name: "Ritual Explorer",
      url: RITUAL_EXPLORER_URL,
    },
  },
});

const RITUAL_CHAIN_PARAMS = {
  chainId: RITUAL_CHAIN_ID_HEX,
  chainName: "RITUAL TESTNET",
  nativeCurrency: {
    name: "RITUAL",
    symbol: "RITUAL",
    decimals: 18,
  },
  rpcUrls: [RITUAL_RPC_URL],
  blockExplorerUrls: [RITUAL_EXPLORER_URL],
};

export const publicClient = createPublicClient({
  chain: ritualChain,
  transport: http(RITUAL_RPC_URL),
});

export const puzzleContractAddress = normalizeContractAddress(
  import.meta.env.VITE_PUZZLE_CONTRACT_ADDRESS ?? DEFAULT_PUZZLE_CONTRACT_ADDRESS,
);

export type LeaderboardEntry = {
  rank: number;
  address: Address;
  points: bigint;
};

type EthereumProvider = EIP1193Provider & {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function hasPuzzleContract(): boolean {
  return Boolean(puzzleContractAddress);
}

export async function connectWallet(): Promise<{
  address: Address;
  chainReady: boolean;
  chainError: string | null;
}> {
  const provider = getProvider();
  const accounts = await provider.request({ method: "eth_requestAccounts" });

  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
    throw new Error("Wallet did not return an address.");
  }

  if (!isAddress(accounts[0])) {
    throw new Error("Wallet returned an invalid address.");
  }

  let chainReady = true;
  let chainError: string | null = null;

  try {
    await ensureRitualChain(provider);
  } catch (error) {
    chainReady = false;
    chainError = getWalletErrorMessage(error);
  }

  return {
    address: getAddress(accounts[0]),
    chainReady,
    chainError,
  };
}

export async function ensureRitualChain(provider = getProvider()): Promise<void> {
  const currentChainId = await readWalletChainId(provider);

  if (currentChainId?.toLowerCase() === RITUAL_CHAIN_ID_HEX) {
    return;
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: RITUAL_CHAIN_ID_HEX }],
    });
  } catch (error) {
    if (!shouldTryAddRitualChain(error)) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [RITUAL_CHAIN_PARAMS],
    });

    const chainIdAfterAdd = await readWalletChainId(provider);

    if (chainIdAfterAdd?.toLowerCase() !== RITUAL_CHAIN_ID_HEX) {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: RITUAL_CHAIN_ID_HEX }],
      });
    }
  }
}

export async function addOrSwitchRitualChain(): Promise<void> {
  await ensureRitualChain();
}

export async function getNativeBalance(address: Address): Promise<string> {
  const balance = await publicClient.getBalance({ address });
  return Number(formatEther(balance)).toFixed(4);
}

export async function getTopLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!puzzleContractAddress) {
    return [];
  }

  const [players, points] = await publicClient.readContract({
    address: puzzleContractAddress,
    abi: puzzleCompletionAbi,
    functionName: "getTopPlayers",
  });

  return players.map((player, index) => ({
    rank: index + 1,
    address: player,
    points: points[index] ?? 0n,
  }));
}

export async function writeScore(params: {
  player: Address;
  puzzleHash: `0x${string}`;
  rows: number;
  cols: number;
  moves: number;
  secondsTaken: number;
  completionHash: `0x${string}`;
}): Promise<Hash> {
  if (!puzzleContractAddress) {
    throw new Error("Puzzle score contract address is not configured.");
  }

  await ensureRitualChain();

  const provider = getProvider();
  const gasPrice = await publicClient.getGasPrice();
  const data = encodeFunctionData({
    abi: puzzleCompletionAbi,
    functionName: "submitScore",
    args: [
      params.puzzleHash,
      params.rows,
      params.cols,
      params.moves,
      params.secondsTaken,
      params.completionHash,
    ],
  });
  const gas = await publicClient.estimateGas({
    account: params.player,
    to: puzzleContractAddress,
    data,
  });
  const maxPriorityFeePerGas = gasPrice;
  const maxFeePerGas = gasPrice * 2n;

  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [{
      from: params.player,
      to: puzzleContractAddress,
      data,
      gas: toHex((gas * 12n) / 10n),
      maxFeePerGas: toHex(maxFeePerGas),
      maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
      type: "0x2",
      value: "0x0",
    }],
  });

  if (typeof hash !== "string") {
    throw new Error("Wallet did not return a transaction hash.");
  }

  return hash as Hash;
}

export async function waitForCompletionReceipt(hash: Hash) {
  return publicClient.waitForTransactionReceipt({ hash });
}

export function explorerTxUrl(hash: Hash): string {
  return `${ritualChain.blockExplorers.default.url}/tx/${hash}`;
}

export function shortAddress(address: Address | string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeContractAddress(value: unknown): Address | null {
  if (typeof value !== "string" || value.length === 0 || value === ZERO_ADDRESS) {
    return null;
  }

  return isAddress(value) ? getAddress(value) : null;
}

function getProvider(): EthereumProvider {
  if (!window.ethereum) {
    throw new Error("No injected wallet found.");
  }

  return window.ethereum;
}

function getErrorCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  if (typeof code === "number") {
    return code;
  }

  if (typeof code === "string") {
    const parsed = Number(code);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function shouldTryAddRitualChain(error: unknown): boolean {
  const code = getErrorCode(error);

  if (code === 4001) {
    return false;
  }

  if (code === 4902) {
    return true;
  }

  const message = getErrorText(error).toLowerCase();
  return (
    message.includes("unrecognized chain") ||
    message.includes("unknown chain") ||
    message.includes("chain has not been added") ||
    message.includes("not been added") ||
    message.includes("not added") ||
    message.includes("wallet_addethereumchain")
  );
}

function getWalletErrorMessage(error: unknown): string {
  const code = getErrorCode(error);

  if (code === 4001) {
    return "Wallet connected, but RITUAL TESTNET network switch was rejected.";
  }

  const message = getErrorText(error);
  if (message.length > 0) {
    return `Wallet connected, but RITUAL TESTNET network switch failed: ${message}`;
  }

  return "Wallet connected, but RITUAL TESTNET network switch failed. Add RITUAL TESTNET manually if submit fails.";
}

async function readWalletChainId(provider: EthereumProvider): Promise<string | null> {
  try {
    const chainId = await provider.request({ method: "eth_chainId" });
    return typeof chainId === "string" ? chainId : null;
  } catch {
    return null;
  }
}

function getErrorText(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }

  return "";
}
