"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import {
  SUPPORTED_CHAINS,
  DEX_THRESH_OPTIONS,
  MIGRATOR_OPTIONS,
  getChainByKey,
} from "@/lib/chains";
import type { GeckoTokenData, TrendingTokenCard } from "@/lib/gecko-types";
import { fetchAiFillToken, fetchTokenInfoByAddress, fetchTrendingTokens } from "@/lib/geckoterminal-client";

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

interface LaunchHistoryEntry {
  name: string;
  symbol: string;
  chain: string;
  tokenAddress: string;
  txHash: string;
  timestamp: number;
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

  // --- Remember last used chain (browser only, nothing sent to server) ---
  const LAST_CHAIN_KEY = "flap_last_chain";
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_CHAIN_KEY);
      if (saved && getChainByKey(saved)) {
        // Restoring browser-only state (localStorage) after mount is exactly
        // what this effect is for; doing it in the initializer instead would
        // cause a server/client hydration mismatch since localStorage doesn't
        // exist during SSR.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChain(saved);
        const c = getChainByKey(saved);
        if (c) setRpcUrl(c.rpcUrl);
      }
    } catch {
      // localStorage unavailable (private browsing, etc) - just use the default chain.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LAST_CHAIN_KEY, chain);
    } catch {
      // Non-fatal - just means the chain won't be remembered next visit.
    }
  }, [chain]);

  // --- Launch history (browser only, nothing sent to or stored on the server) ---
  const HISTORY_KEY = "flap_launch_history";
  const MAX_HISTORY_ENTRIES = 50;
  const [history, setHistory] = useState<LaunchHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      // Restoring saved history from localStorage after mount, same as above.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      // Corrupt or unavailable storage - just start with an empty history.
    }
  }, []);

  const addToHistory = (entry: LaunchHistoryEntry) => {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, MAX_HISTORY_ENTRIES);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // Non-fatal - the entry just won't persist across reloads.
      }
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // Nothing to do if storage isn't available.
    }
  };

  // --- 30-second cooldown after a successful launch, purely client-side ---
  // No server calls or requests of any kind - just a countdown timer running
  // in the browser that disables the Launch button until it reaches zero.
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    if (!cooldownUntil) {
      // This effect's whole job is deriving cooldownRemaining from cooldownUntil.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCooldownRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownRemaining(remaining);
      if (remaining <= 0) setCooldownUntil(null);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [cooldownUntil]);

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
      // Scans the currently selected target chain, not always BSC. Calls
      // GeckoTerminal directly from this browser (falls back to our server
      // route automatically if that's ever blocked).
      const token = await fetchAiFillToken(chain);
      fillFormFromToken(token);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Network error");
    } finally {
      setAiFetching(false);
    }
  };

  // Shared by both the AI Fill button and clicking a card in the Trending
  // Memecoins dashboard below - same fields, same behavior.
  const fillFormFromToken = (token: GeckoTokenData) => {
    setName(token.name);
    setSymbol(token.symbol);
    setMetaCid("");
    setDescription(token.description || `${token.name} - A trending token on ${selectedChain?.name ?? chain}`);
    setImageUrl(token.imageUrl || "");
    setWebsite(token.websites?.[0] || "");
    setTwitter(token.twitter || "");
    setTelegram(token.telegram || "");
    setAiToken(token);
  };

  // --- Trending Memecoins dashboard ---
  // Fetches ONLY when the person presses the Refresh button - never on a
  // timer or on mount, to keep GeckoTerminal API usage (and hosting cost)
  // to exactly one call per press.
  const [trendingChain, setTrendingChain] = useState(chain);
  const [trendingMode, setTrendingMode] = useState<"hot" | "new">("hot");
  const [trendingTokens, setTrendingTokens] = useState<TrendingTokenCard[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState("");
  const [trendingFetchedOnce, setTrendingFetchedOnce] = useState(false);
  const [trendingFillingAddress, setTrendingFillingAddress] = useState<string | null>(null);

  const handleFetchTrending = async () => {
    setTrendingLoading(true);
    setTrendingError("");
    try {
      const tokens = await fetchTrendingTokens(trendingChain, trendingMode);
      setTrendingTokens(tokens);
    } catch (err: unknown) {
      setTrendingError(err instanceof Error ? err.message : "Failed to fetch trending tokens");
      setTrendingTokens([]);
    } finally {
      setTrendingLoading(false);
      setTrendingFetchedOnce(true);
    }
  };

  const handleTrendingCardClick = async (card: TrendingTokenCard) => {
    setTrendingFillingAddress(card.address);
    setAiError("");
    try {
      const enrichedToken = await fetchTokenInfoByAddress(card.chain, card.address);
      // Combine the enrichment (description/socials/image) with the price
      // and volume we already fetched for the dashboard card - no need to
      // ask GeckoTerminal for those a second time.
      const merged: GeckoTokenData = {
        ...enrichedToken,
        volume24h: card.volume24h,
        priceUsd: card.priceUsd,
        fdv: null,
        poolCreatedAt: "",
        poolName: `${card.name}/${card.symbol}`,
      };
      if (chain !== card.chain) setChain(card.chain);
      fillFormFromToken(merged);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Network error");
    } finally {
      setTrendingFillingAddress(null);
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
    if (cooldownRemaining > 0) return; // extra guard alongside the disabled button
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
        addToHistory({
          name,
          symbol,
          chain: data.chain || chain,
          tokenAddress: data.tokenAddress,
          txHash: data.txHash,
          timestamp: Date.now(),
        });
        setCooldownUntil(Date.now() + 30000);
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
    <>
      {/* Launch History (browser only - nothing saved on the server) */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="flex items-center gap-1.5 rounded-md border border-gray-800 bg-gray-900/60 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-gray-800"
        >
          📜 Launch History {history.length > 0 && `(${history.length})`}
          <span className="text-gray-500">{showHistory ? "▲" : "▼"}</span>
        </button>
      </div>

      {showHistory && (
        <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Saved only in this browser - never sent to or stored on any server.
            </p>
            {history.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="text-xs font-medium text-red-400 hover:text-red-300"
              >
                Clear
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-800 px-3 py-4 text-center text-xs text-gray-500">
              No tokens launched yet in this browser.
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {history.map((h, i) => {
                const c = getChainByKey(h.chain);
                return (
                  <div key={`${h.txHash}-${i}`} className="flex items-center justify-between rounded-md border border-gray-800 bg-gray-950/60 px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {h.name} <span className="text-gray-500">${h.symbol}</span>
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {c?.name || h.chain} · {new Date(h.timestamp).toLocaleString()}
                      </p>
                    </div>
                    {c && (
                      <a
                        href={`${c.explorer}/token/${h.tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 flex-shrink-0 text-indigo-400 underline hover:text-indigo-300"
                      >
                        View ↗
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Trending Memecoins Dashboard */}
      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-bold text-white">
              🔥 Trending Memecoins
            </p>
            <p className="text-[11px] text-gray-500">Click a token to fill the form below</p>
          </div>
          <button
            type="button"
            onClick={handleFetchTrending}
            disabled={trendingLoading}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
              trendingLoading
                ? "cursor-not-allowed bg-gray-700 text-gray-500"
                : "bg-gray-800 text-gray-200 hover:bg-gray-700"
            }`}
          >
            {trendingLoading ? "Fetching..." : trendingFetchedOnce ? "🔄 Refresh" : "📡 Fetch Trending"}
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={trendingChain}
            onChange={(e) => setTrendingChain(e.target.value)}
            className="rounded-md border border-gray-700 bg-gray-800/60 px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
          >
            {SUPPORTED_CHAINS.filter((c) => c.geckoNetwork).map((c) => (
              <option key={c.key} value={c.key}>{c.name}</option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-md border border-gray-700">
            <button
              type="button"
              onClick={() => setTrendingMode("hot")}
              className={`px-3 py-1.5 text-xs font-semibold transition ${
                trendingMode === "hot" ? "bg-orange-600 text-white" : "bg-gray-800/60 text-gray-400 hover:text-gray-200"
              }`}
            >
              🔥 Hot
            </button>
            <button
              type="button"
              onClick={() => setTrendingMode("new")}
              className={`px-3 py-1.5 text-xs font-semibold transition ${
                trendingMode === "new" ? "bg-indigo-600 text-white" : "bg-gray-800/60 text-gray-400 hover:text-gray-200"
              }`}
            >
              🕐 New
            </button>
          </div>
        </div>

        {trendingError && (
          <p className="mb-2 rounded-md border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            {trendingError}
          </p>
        )}

        {!trendingFetchedOnce && !trendingLoading && !trendingError && (
          <p className="rounded-md border border-dashed border-gray-800 px-3 py-4 text-center text-xs text-gray-500">
            Press &quot;Fetch Trending&quot; to load tokens - this app never auto-refreshes, so nothing is fetched until you ask for it.
          </p>
        )}

        {trendingTokens.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {trendingTokens.map((t) => (
              <button
                key={t.address}
                type="button"
                onClick={() => handleTrendingCardClick(t)}
                disabled={trendingFillingAddress === t.address}
                className="flex w-40 flex-shrink-0 flex-col items-start gap-1.5 rounded-lg border border-gray-800 bg-gray-950/60 p-3 text-left transition hover:border-indigo-500/50 hover:bg-gray-900 disabled:opacity-60"
              >
                <div className="flex w-full items-center gap-2">
                  {t.imageUrl ? (
                    <div className="relative h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-gray-800">
                      <Image src={t.imageUrl} alt={t.symbol} fill className="object-cover" unoptimized
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  ) : (
                    <div className="h-7 w-7 flex-shrink-0 rounded-full bg-gray-800" />
                  )}
                  <span className="truncate text-xs font-bold text-white">{t.name}</span>
                </div>
                <p className="text-xs text-gray-300">
                  ${t.priceUsd < 0.01 ? t.priceUsd.toPrecision(3) : t.priceUsd.toFixed(4)}
                  <span className={`ml-1.5 ${t.priceChange1h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {t.priceChange1h >= 0 ? "↗" : "↘"} {Math.abs(t.priceChange1h).toFixed(1)}% 1h
                  </span>
                </p>
                <p className="text-[10px] text-gray-500">
                  Vol: ${t.volume24h >= 1000 ? `${(t.volume24h / 1000).toFixed(1)}K` : t.volume24h.toFixed(0)} · {t.ageDays}d
                </p>
                {trendingFillingAddress === t.address && (
                  <p className="text-[10px] text-indigo-400">Loading details...</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

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
        disabled={loading || cooldownRemaining > 0}
        className={`relative w-full overflow-hidden rounded-xl px-6 py-4 text-base font-bold transition-all ${
          loading || cooldownRemaining > 0
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
        ) : cooldownRemaining > 0 ? (
          <span className="flex items-center justify-center gap-2">
            ⏳ Wait {cooldownRemaining}s before launching another
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
    </>
  );
}
