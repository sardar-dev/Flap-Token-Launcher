"use client";

import { useState } from "react";
import { getChainByKey } from "@/lib/chains";

interface WalletBalanceCheckerProps {
  lastDeployerAddress: string | null;
}

interface Balances {
  bnb: number;
  usdtBep20: number;
  ethBase: number;
  ethMainnet: number;
}

// Binance-Peg USDT (BEP-20) on BSC. Confirmed 18 decimals (not the 6
// decimals USDT uses on Ethereum) - BSC-pegged stablecoins commonly
// re-implement with 18 decimals, so this is deliberately not reused from
// any Ethereum-side USDT constant.
const USDT_BEP20_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

const PRIVATE_KEY_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export default function WalletBalanceChecker({ lastDeployerAddress }: WalletBalanceCheckerProps) {
  const [input, setInput] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runCheck = async (addressToCheck: string) => {
    setLoading(true);
    setError("");
    try {
      const { JsonRpcProvider, Contract, formatEther, formatUnits } = await import("ethers");

      const bscRpc = getChainByKey("BSC")?.rpcUrl;
      const baseRpc = getChainByKey("BASE")?.rpcUrl;
      const ethRpc = getChainByKey("ETHEREUM")?.rpcUrl;
      if (!bscRpc || !baseRpc || !ethRpc) {
        throw new Error("Missing RPC configuration for one of these chains.");
      }

      const bscProvider = new JsonRpcProvider(bscRpc);
      const baseProvider = new JsonRpcProvider(baseRpc);
      const ethProvider = new JsonRpcProvider(ethRpc);

      const usdtContract = new Contract(
        USDT_BEP20_ADDRESS,
        ["function balanceOf(address) view returns (uint256)"],
        bscProvider
      );

      const [bnbWei, usdtRaw, baseWei, ethWei] = await Promise.all([
        bscProvider.getBalance(addressToCheck),
        usdtContract.balanceOf(addressToCheck) as Promise<bigint>,
        baseProvider.getBalance(addressToCheck),
        ethProvider.getBalance(addressToCheck),
      ]);

      setBalances({
        bnb: Number(formatEther(bnbWei)),
        usdtBep20: Number(formatUnits(usdtRaw, 18)),
        ethBase: Number(formatEther(baseWei)),
        ethMainnet: Number(formatEther(ethWei)),
      });
      setResolvedAddress(addressToCheck);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch balances. Check your RPC connectivity and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async () => {
    const trimmed = input.trim();
    setError("");

    if (PRIVATE_KEY_PATTERN.test(trimmed)) {
      try {
        const { Wallet } = await import("ethers");
        const address = new Wallet(trimmed).address;
        await runCheck(address);
      } catch {
        setError("That doesn't look like a valid private key.");
      }
      return;
    }

    if (ADDRESS_PATTERN.test(trimmed)) {
      await runCheck(trimmed);
      return;
    }

    setError("Paste a wallet address (0x + 40 characters) or a private key (0x + 64 characters).");
  };

  const handleReload = () => {
    if (resolvedAddress) runCheck(resolvedAddress);
  };

  const handleUseLastDeployer = () => {
    if (lastDeployerAddress) setInput(lastDeployerAddress);
  };

  const fmt = (n: number) => (n === 0 ? "0" : n < 0.0001 ? n.toExponential(2) : n.toFixed(n < 1 ? 6 : 4));

  return (
    <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="mb-3">
        <p className="text-sm font-bold text-white">💼 Wallet Balance Checker</p>
        <p className="text-[11px] text-gray-500">
          Paste any wallet address or private key - works for any wallet, not just ones you&apos;ve used to launch.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x... wallet address or private key"
          className="w-full flex-1 rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 font-mono text-xs text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 sm:text-sm"
        />
        <div className="flex gap-2">
          {lastDeployerAddress && (
            <button
              type="button"
              onClick={handleUseLastDeployer}
              className="whitespace-nowrap rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-700"
            >
              Use last deployed
            </button>
          )}
          <button
            type="button"
            onClick={handleCheck}
            disabled={loading || !input.trim()}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold transition ${
              loading || !input.trim()
                ? "cursor-not-allowed bg-gray-700 text-gray-500"
                : "bg-indigo-600 text-white hover:bg-indigo-500"
            }`}
          >
            {loading ? "Checking..." : "Check Balance"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-2 rounded-md border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-300">{error}</p>
      )}

      {balances && resolvedAddress && (
        <div className="mt-3 rounded-lg border border-gray-800 bg-gray-950/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate font-mono text-[11px] text-gray-500">{resolvedAddress}</p>
            <button
              type="button"
              onClick={handleReload}
              disabled={loading}
              className="flex-shrink-0 rounded-md border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? "..." : "🔄 Reload"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-md bg-gray-900/60 p-2 text-center">
              <p className="text-[10px] text-gray-500">BNB</p>
              <p className="text-sm font-bold text-white">{fmt(balances.bnb)}</p>
              {balances.bnb === 0 && <p className="text-[9px] text-amber-500">May not cover gas</p>}
            </div>
            <div className="rounded-md bg-gray-900/60 p-2 text-center">
              <p className="text-[10px] text-gray-500">USDT (BEP20)</p>
              <p className="text-sm font-bold text-white">{fmt(balances.usdtBep20)}</p>
            </div>
            <div className="rounded-md bg-gray-900/60 p-2 text-center">
              <p className="text-[10px] text-gray-500">ETH (Base)</p>
              <p className="text-sm font-bold text-white">{fmt(balances.ethBase)}</p>
            </div>
            <div className="rounded-md bg-gray-900/60 p-2 text-center">
              <p className="text-[10px] text-gray-500">ETH (Ethereum)</p>
              <p className="text-sm font-bold text-white">{fmt(balances.ethMainnet)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
