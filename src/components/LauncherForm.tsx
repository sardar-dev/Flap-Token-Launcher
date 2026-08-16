"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import {
  SUPPORTED_CHAINS,
  DEX_THRESH_OPTIONS,
  MIGRATOR_OPTIONS,
  getChainByKey,
} from "@/lib/chains";

interface LaunchResult {
  success: boolean;
  txHash?: string;
  deployer?: string;
  tokenAddress?: string;
  imageUrl?: string;
  chain?: string;
  currency?: string;
  error?: string;
  logs?: string[];
  method?: string;
  balanceBeforeNative?: number;
  balanceAfterNative?: number;
  costNative?: number;
  nativeUsdPrice?: number | null;
}

interface GeckoTokenData {
  name: string;
  symbol: string;
  address: string;
  description: string;
  imageUrl: string;
  websites: string[];
  twitter: string;
  telegram: string;
  volume24h: number;
  priceUsd: number;
  fdv: number | null;
  poolCreatedAt: string;
  poolName: string;
}

export default function LauncherForm({
  onLaunchComplete,
}: {
  onLaunchComplete: () => void;
}) {
  const [chain, setChain] = useState("BSC");
  const [rpcUrl, setRpcUrl] = useState("https://bsc-dataseed.binance.org");
  const [privateKey, setPrivateKey] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [metaCid, setMetaCid] = useState("");
  const [dexThresh, setDexThresh] = useState(1);
  const [migratorType, setMigratorType] = useState(1);
  const [taxRate, setTaxRate] = useState("200"); // Default 2% (200 bps)
  const [initialBuy, setInitialBuy] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [caCopySuccess, setCaCopySuccess] = useState(false);

  // Token image & metadata
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");

  // AI Auto-fill state
  const [aiFetching, setAiFetching] = useState(false);
  const [aiToken, setAiToken] = useState<GeckoTokenData | null>(null);
  const [aiError, setAiError] = useState("");

  const logsEndRef = useRef<HTMLDivElement>(null);
  const selectedChain = getChainByKey(chain);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleChainChange = useCallback((newChain: string) => {
    setChain(newChain);
    const c = getChainByKey(newChain);
    if (c) setRpcUrl(c.rpcUrl);
  }, []);

  const handleAiFill = async () => {
    setAiFetching(true);
    setAiError("");
    setAiToken(null);

    try {
      // Scans the currently selected target chain, not always BSC
      const res = await fetch(`/api/gecko-token?chain=${encodeURIComponent(chain)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setAiError(data.error || "Failed to fetch token data");
        return;
      }

      const token: GeckoTokenData = data.token;

      // Fill fields from AI data. Metadata CID is intentionally left as-is:
      // there's no such thing as a valid "example" CID to borrow from another
      // token, so it's generated for real (from imageUrl below) when you launch.
      setName(token.name);
      setSymbol(token.symbol);
      setMetaCid("");
      setDescription(token.description || `${token.name} - A trending token on ${selectedChain?.name ?? chain}`);
      setImageUrl(token.imageUrl || "");
      setWebsite(token.websites?.[0] || "");
      setTwitter(token.twitter || "");
      setTelegram(token.telegram || "");
      
      setAiToken(token);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Network error");
    } finally {
      setAiFetching(false);
    }
  };

  const handleCopyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logs.join("\n"));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      const text = logs.join("\n");
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCaCopySuccess(true);
      setTimeout(() => setCaCopySuccess(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = address;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCaCopySuccess(true);
      setTimeout(() => setCaCopySuccess(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setLogs(["[Starting] Flap Token Launcher..."]);

    try {
      const res = await fetch("/api/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          rpcUrl,
          privateKey,
          name,
          symbol,
          metaCid,
          dexThresh,
          migratorType,
          taxRate: Number(taxRate),
          initialBuy: initialBuy || "0",
          imageUrl,
          description,
          website,
          twitter,
          telegram,
        }),
      });

      const data = await res.json();

      if (data.logs && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }

      if (res.ok && data.success) {
        setResult({ success: true, ...data });
        onLaunchComplete();
      } else {
        setResult({ success: false, error: data.error, logs: data.logs });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Network error";
      setLogs((prev) => [...prev, `[Error] ${errMsg}`]);
      setResult({ success: false, error: errMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Chain Selection */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-indigo-400">
          🌐 Target Blockchain
        </label>
        <p className="mb-2 text-[11px] text-gray-500">
          Select which chain to deploy your token on
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SUPPORTED_CHAINS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => handleChainChange(c.key)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                chain === c.key
                  ? "border-indigo-500 bg-indigo-500/20 text-indigo-300 shadow-lg shadow-indigo-500/10"
                  : "border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-300"
              }`}
            >
              {c.name}
              <span className="ml-1 text-[10px] text-gray-500">({c.currency})</span>
            </button>
          ))}
        </div>
      </div>

      {/* RPC URL */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
          🔗 RPC Endpoint
        </label>
        <p className="mb-1.5 text-[11px] text-gray-500">
          Network RPC URL (auto-filled based on chain)
        </p>
        <input
          type="url"
          value={rpcUrl}
          onChange={(e) => setRpcUrl(e.target.value)}
          placeholder="https://bsc-dataseed.binance.org"
          className="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
          required
        />
      </div>

      {/* Private Key */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
          🔑 Deployer Private Key <span className="text-red-400">*</span>
        </label>
        <p className="mb-1.5 text-[11px] text-gray-500">
          Your wallet key for signing the deployment (never stored, processed client-side)
        </p>
        <input
          type="password"
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          placeholder="0x..."
          className="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 font-mono text-sm text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
          required
        />
        <p className="mt-1 text-[11px] text-amber-500">
          ⚠️ Use a dedicated deployment wallet with minimal funds
        </p>
      </div>

      {/* Token Name & Symbol */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
            📛 Token Name <span className="text-red-400">*</span>
          </label>
          <p className="mb-1.5 text-[11px] text-gray-500">Full name (e.g., &quot;Flap Moon&quot;)</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Flap Moon"
            className="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
            🏷️ Token Symbol <span className="text-red-400">*</span>
          </label>
          <p className="mb-1.5 text-[11px] text-gray-500">Ticker (e.g., &quot;MOON&quot;)</p>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="e.g. MOON"
            className="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
            required
          />
        </div>
      </div>

      {/* IPFS CID with AI Fill */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
          📦 Metadata CID <span className="text-gray-600">(auto-generated if empty)</span>
        </label>
        <p className="mb-1.5 text-[11px] text-gray-500">
          IPFS CID for token metadata. Press <strong className="text-violet-400">AI Fill</strong> to auto-generate from trending tokens.
        </p>
        <div className="relative">
          <input
            type="text"
            value={metaCid}
            onChange={(e) => setMetaCid(e.target.value)}
            placeholder="Leave empty to auto-generate, or use AI Fill"
            className="w-full rounded-lg border border-gray-700 bg-gray-800/60 py-2.5 pl-4 pr-[120px] font-mono text-sm text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
          />
          <button
            type="button"
            onClick={handleAiFill}
            disabled={aiFetching}
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
              aiFetching
                ? "cursor-not-allowed bg-gray-700 text-gray-500"
                : "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 hover:brightness-110 active:scale-95"
            }`}
          >
            {aiFetching ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Scanning...
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                AI Fill
              </>
            )}
          </button>
        </div>

        {aiError && (
          <div className="mt-2 rounded-md border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-400">
            ⚠️ {aiError}
          </div>
        )}

        {/* AI Token Card with Image */}
        {aiToken && (
          <div className="mt-3 overflow-hidden rounded-lg border border-violet-500/30 bg-violet-950/20">
            <div className="flex items-center gap-2 border-b border-violet-500/20 bg-violet-500/10 px-3 py-2">
              <span className="text-xs font-bold text-violet-300">✨ AI Data Loaded</span>
            </div>
            <div className="p-3">
              <div className="flex items-start gap-3">
                {/* Token Image */}
                {aiToken.imageUrl ? (
                  <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border-2 border-violet-500/30">
                    <Image
                      src={aiToken.imageUrl}
                      alt={aiToken.name}
                      fill
                      className="object-cover"
                      unoptimized
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-800 text-2xl">
                    🪙
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-white">{aiToken.name}</p>
                  <p className="text-xs text-gray-400">${aiToken.symbol}</p>
                  <div className="mt-1 flex gap-2">
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400">
                      Vol: ${aiToken.volume24h.toLocaleString()}
                    </span>
                    {aiToken.imageUrl && (
                      <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-400">
                        🖼️ Image included
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-2 truncate font-mono text-[10px] text-gray-600">
                Contract: {aiToken.address}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Token Image URL */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
          🖼️ Token Image URL <span className="text-gray-600">(optional)</span>
        </label>
        <p className="mb-1.5 text-[11px] text-gray-500">
          Auto-uploaded to permanent hosting (no API keys needed)
        </p>
        <div className="flex items-center gap-3">
          {imageUrl && (
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-gray-700">
              <Image
                src={imageUrl}
                alt="Token"
                fill
                className="object-cover"
                unoptimized
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://... (or filled by AI)"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
          />
        </div>
      </div>

      {/* Advanced Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-sm font-medium text-indigo-400 transition hover:text-indigo-300"
      >
        <svg className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        ⚙️ Advanced Options
      </button>

      {showAdvanced && (
        <div className="space-y-4 rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                📊 DEX Migration Threshold
              </label>
              <p className="mb-1.5 text-[11px] text-gray-500">When to migrate to DEX</p>
              <select
                value={dexThresh}
                onChange={(e) => setDexThresh(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500"
              >
                {DEX_THRESH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                🔄 Migrator Type
              </label>
              <p className="mb-1.5 text-[11px] text-gray-500">DEX version</p>
              <select
                value={migratorType}
                onChange={(e) => setMigratorType(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white outline-none transition focus:border-indigo-500"
              >
                {MIGRATOR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                💸 Tax Rate (Basis Points)
              </label>
              <p className="mb-1.5 text-[11px] text-gray-500">100 = 1%, 0 = no tax</p>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="0"
                min={0}
                max={10000}
                className="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                🛒 Initial Buy <span className="text-gray-600">(Optional)</span>
              </label>
              <p className="mb-1.5 text-[11px] text-gray-500">{selectedChain?.currency || "Native"} to buy on launch</p>
              <input
                type="text"
                value={initialBuy}
                onChange={(e) => setInitialBuy(e.target.value)}
                placeholder="0 (no buy)"
                className="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          {/* Token Description */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              📝 Token Description
            </label>
            <p className="mb-1.5 text-[11px] text-gray-500">Shown on flap.sh and explorers</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your token..."
              rows={2}
              className="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
            />
          </div>

          {/* Social Links */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                🌐 Website
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                🐦 Twitter
              </label>
              <input
                type="text"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="@handle"
                className="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                💬 Telegram
              </label>
              <input
                type="text"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@group"
                className="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className={`relative w-full overflow-hidden rounded-xl px-6 py-4 text-base font-bold transition-all ${
          loading
            ? "cursor-not-allowed bg-gray-700 text-gray-400"
            : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/40 hover:brightness-110"
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-3">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Deploying...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            🚀 Launch on {selectedChain?.name ?? chain}
          </span>
        )}
      </button>

      {/* Logs */}
      {(loading || logs.length > 0) && (
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-300">
              📋 Deployment Logs
            </h3>
            <div className="flex items-center gap-2">
              {loading && (
                <span className="flex items-center gap-1.5 text-xs text-amber-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                  Running
                </span>
              )}
              <button
                type="button"
                onClick={handleCopyLogs}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  copySuccess
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                {copySuccess ? "✅ Copied!" : "📋 Copy"}
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg bg-black/50 p-3 font-mono text-xs">
            {logs.map((log, i) => {
              let colorClass = "text-gray-400";
              if (log.includes("✅") || log.includes("success") || log.includes("🎉")) {
                colorClass = "text-emerald-400";
              } else if (log.includes("❌") || log.includes("Error") || log.includes("Failed")) {
                colorClass = "text-red-400";
              } else if (log.includes("⚠️") || log.includes("Warning")) {
                colorClass = "text-amber-400";
              } else if (log.includes("🚀") || log.includes("📤") || log.includes("⏳")) {
                colorClass = "text-indigo-400";
              } else if (log.includes("💰") || log.includes("👤") || log.includes("📍")) {
                colorClass = "text-cyan-400";
              } else if (log.includes("🎯") || log.includes("🔑") || log.includes("🏷️")) {
                colorClass = "text-violet-400";
              }
              return <div key={i} className={`py-0.5 ${colorClass}`}>{log}</div>;
            })}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-xl border p-5 ${result.success ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-300" : "border-red-500/30 bg-red-950/30 text-red-300"}`}>
          {result.success ? (
            <div className="space-y-3">
              <div className="flex items-start gap-4">
                {/* Token Image in Result */}
                {result.imageUrl && (
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 border-emerald-500/30">
                    <Image
                      src={result.imageUrl}
                      alt="Token"
                      fill
                      className="object-cover"
                      unoptimized
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div className="flex-1">
                  <p className="flex items-center gap-2 text-base font-bold">
                    ✅ Token Deployed!
                  </p>
                  <div className="mt-2 space-y-1 text-sm">
                    {result.tokenAddress && (
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span className="text-gray-400">Token:</span>{" "}
                        {result.chain && selectedChain ? (
                          <a
                            href={`${selectedChain.explorer}/token/${result.tokenAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-emerald-400 underline hover:text-emerald-300"
                          >
                            {result.tokenAddress}
                          </a>
                        ) : (
                          <span className="font-mono text-xs">{result.tokenAddress}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyAddress(result.tokenAddress!)}
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-all ${
                            caCopySuccess
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                          }`}
                        >
                          {caCopySuccess ? "✅ Copied" : "📋 Copy"}
                        </button>
                      </p>
                    )}
                    <p><span className="text-gray-400">Method:</span> <span className="font-mono text-xs text-indigo-400">{result.method}</span></p>
                    <p>
                      <span className="text-gray-400">TX:</span>{" "}
                      {result.chain && result.txHash ? (
                        <a href={getChainByKey(result.chain)?.explorerTx(result.txHash)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-indigo-400 underline hover:text-indigo-300">
                          {result.txHash}
                        </a>
                      ) : (
                        <span className="font-mono text-xs">{result.txHash}</span>
                      )}
                    </p>
                    {result.balanceBeforeNative !== undefined && result.balanceAfterNative !== undefined && (
                      <div className="mt-2 space-y-0.5 border-t border-emerald-500/20 pt-2 text-xs text-gray-400">
                        <p>
                          Balance before: <span className="text-gray-200">{result.balanceBeforeNative.toFixed(6)} {result.currency}</span>
                          {result.nativeUsdPrice != null && (
                            <span className="text-gray-500"> (~${(result.balanceBeforeNative * result.nativeUsdPrice).toFixed(2)})</span>
                          )}
                        </p>
                        <p>
                          Balance after: <span className="text-gray-200">{result.balanceAfterNative.toFixed(6)} {result.currency}</span>
                          {result.nativeUsdPrice != null && (
                            <span className="text-gray-500"> (~${(result.balanceAfterNative * result.nativeUsdPrice).toFixed(2)})</span>
                          )}
                        </p>
                        <p>
                          Cost of this launch: <span className="text-amber-400">{result.costNative?.toFixed(6)} {result.currency}</span>
                          {result.nativeUsdPrice != null && result.costNative !== undefined && (
                            <span className="text-gray-500"> (~${(result.costNative * result.nativeUsdPrice).toFixed(2)})</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="flex items-start gap-2">
              ❌ <span><strong>Failed:</strong> {result.error}</span>
            </p>
          )}
        </div>
      )}
    </form>
  );
}
