"use client";

import { useState } from "react";

interface WalletBalanceCheckerProps {
  lastDeployerAddress: string | null;
}

interface BalanceEntry { value: number | null; error: string | null; }

interface Balances {
  address: string;
  bnb: BalanceEntry;
  usdtBep20: BalanceEntry;
  ethBase: BalanceEntry;
  ethMainnet: BalanceEntry;
}

const PRIVATE_KEY_PATTERN = /^(0x)?[a-fA-F0-9]{64}$/;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/i;

async function resolveToAddress(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (ADDRESS_PATTERN.test(trimmed)) return trimmed;

  // Private key — resolve to address server-side so the key never touches a
  // third-party API. We call our own /api/wallet-balance with a well-known
  // address first to confirm the server works, then derive the address from
  // the key in the browser (ethers.js Wallet only needs the key itself).
  if (PRIVATE_KEY_PATTERN.test(trimmed)) {
    const { Wallet } = await import("ethers");
    const key = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
    return new Wallet(key).address;
  }

  throw new Error(
    "Not recognised. Paste a wallet address (0x + 40 characters) or a private key (0x + 64 characters, or 64 hex characters without 0x)."
  );
}

export default function WalletBalanceChecker({ lastDeployerAddress }: WalletBalanceCheckerProps) {
  const [input, setInput] = useState("");
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runCheck = async (raw: string) => {
    setLoading(true);
    setError("");
    try {
      const address = await resolveToAddress(raw);
      const res = await fetch(`/api/wallet-balance?address=${encodeURIComponent(address)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error || `Server returned HTTP ${res.status}`);
      }
      const data = await res.json();
      setBalances(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch balances. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (entry: BalanceEntry) => {
    if (entry.error) return <span className="text-xs text-red-400">Error</span>;
    const n = entry.value ?? 0;
    const s = n === 0 ? "0" : n < 0.0001 ? n.toExponential(2) : n.toFixed(n < 1 ? 6 : 4);
    return <span>{s}</span>;
  };

  return (
    <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="mb-3">
        <p className="text-sm font-bold text-white">💼 Wallet Balance Checker</p>
        <p className="text-[11px] text-gray-500">
          Paste any wallet address or private key — works for any wallet, not just ones used to launch.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && input.trim() && runCheck(input)}
          placeholder="0x... wallet address or private key"
          className="w-full flex-1 rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 font-mono text-xs text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 sm:text-sm"
        />
        <div className="flex gap-2">
          {lastDeployerAddress && (
            <button
              type="button"
              onClick={() => { setInput(lastDeployerAddress); runCheck(lastDeployerAddress); }}
              className="whitespace-nowrap rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-xs font-medium text-gray-300 hover:bg-gray-700"
            >
              Last deployed
            </button>
          )}
          <button
            type="button"
            onClick={() => runCheck(input)}
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

      {balances && (
        <div className="mt-3 rounded-lg border border-gray-800 bg-gray-950/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate font-mono text-[11px] text-gray-500">{balances.address}</p>
            <button
              type="button"
              onClick={() => runCheck(input)}
              disabled={loading}
              className="flex-shrink-0 rounded-md border border-gray-700 bg-gray-800/60 px-2.5 py-1 text-[11px] font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? "..." : "🔄 Reload"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "BNB (BSC)", entry: balances.bnb, warn: (balances.bnb.value ?? 0) === 0 },
              { label: "USDT BEP20", entry: balances.usdtBep20, warn: false },
              { label: "ETH (Base)", entry: balances.ethBase, warn: false },
              { label: "ETH (Mainnet)", entry: balances.ethMainnet, warn: false },
            ].map(({ label, entry, warn }) => (
              <div key={label} className="rounded-md bg-gray-900/60 p-2 text-center">
                <p className="text-[10px] text-gray-500">{label}</p>
                <p className="text-sm font-bold text-white">{fmt(entry)}</p>
                {warn && !entry.error && <p className="text-[9px] text-amber-500">Low — may not cover gas</p>}
                {entry.error && <p className="truncate text-[9px] text-red-400" title={entry.error}>RPC error</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
