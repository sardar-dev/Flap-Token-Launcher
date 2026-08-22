"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { SUPPORTED_CHAINS, getChainByKey } from "@/lib/chains";
import type { GeckoTokenData, TrendingTokenCard } from "@/lib/gecko-types";
import { fetchTrendingTokens, fetchTokenInfoByAddress } from "@/lib/geckoterminal-client";
import { fetchDexScreenerChineseTokens } from "@/lib/dexscreener-client";
import { containsChinese } from "@/lib/cjk";

interface ChineseTokenCard extends TrendingTokenCard {
  source: "GeckoTerminal" | "DexScreener";
}

interface ChineseTokenDashboardProps {
  onFillToken: (token: GeckoTokenData, chain: string) => void;
}

const GECKO_CHAINS = SUPPORTED_CHAINS.filter((c) => c.geckoNetwork);

export default function ChineseTokenDashboard({ onFillToken }: ChineseTokenDashboardProps) {
  // --- Filters ---
  const [chainFilter, setChainFilter] = useState("ALL");
  const [useGecko, setUseGecko] = useState(true);
  const [useDexScreener, setUseDexScreener] = useState(true);
  const [geckoMode, setGeckoMode] = useState<"hot" | "new" | "both">("both");
  const [minVolume, setMinVolume] = useState("100");
  const [maxAgeDays, setMaxAgeDays] = useState("");
  const [sortBy, setSortBy] = useState<"volume" | "change" | "newest">("volume");
  const [searchText, setSearchText] = useState("");

  // --- Results ---
  const [tokens, setTokens] = useState<ChineseTokenCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetchedOnce, setFetchedOnce] = useState(false);
  const [sourceCounts, setSourceCounts] = useState({ gecko: 0, dex: 0 });
  const [fillingAddress, setFillingAddress] = useState<string | null>(null);

  const handleFetch = async () => {
    setLoading(true);
    setError("");

    const chainsToScan = chainFilter === "ALL" ? GECKO_CHAINS : GECKO_CHAINS.filter((c) => c.key === chainFilter);

    if (chainsToScan.length === 0) {
      setError("No scannable chains selected.");
      setLoading(false);
      return;
    }

    const combined: ChineseTokenCard[] = [];

    if (useGecko) {
      const modes: Array<"hot" | "new"> = geckoMode === "both" ? ["hot", "new"] : [geckoMode];
      for (const c of chainsToScan) {
        for (const m of modes) {
          try {
            const list = await fetchTrendingTokens(c.key, m);
            for (const t of list) {
              if (containsChinese(t.name) || containsChinese(t.symbol)) {
                combined.push({ ...t, source: "GeckoTerminal" });
              }
            }
          } catch {
            // Skip this chain/mode on failure, keep scanning the rest.
          }
        }
      }
    }

    let dexCount = 0;
    if (useDexScreener) {
      try {
        const list = await fetchDexScreenerChineseTokens(chainsToScan.map((c) => c.key));
        dexCount = list.length;
        for (const t of list) combined.push({ ...t, source: "DexScreener" });
      } catch {
        // DexScreener source unavailable this round - GeckoTerminal results (if any) still show.
      }
    }

    if (!useGecko && !useDexScreener) {
      setError("Turn on at least one source (GeckoTerminal or DexScreener).");
      setLoading(false);
      setFetchedOnce(true);
      return;
    }

    // De-duplicate by chain+address (the same token can surface from both sources)
    const seen = new Set<string>();
    let deduped = combined.filter((t) => {
      const key = `${t.chain}:${t.address.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const minVol = Number(minVolume) || 0;
    deduped = deduped.filter((t) => t.volume24h >= minVol);

    if (maxAgeDays.trim()) {
      const maxAge = Number(maxAgeDays);
      if (!Number.isNaN(maxAge)) deduped = deduped.filter((t) => t.ageDays <= maxAge);
    }

    deduped.sort((a, b) => {
      if (sortBy === "volume") return b.volume24h - a.volume24h;
      if (sortBy === "change") return b.priceChange1h - a.priceChange1h;
      return a.ageDays - b.ageDays;
    });

    setTokens(deduped.slice(0, 40));
    setSourceCounts({ gecko: deduped.filter((t) => t.source === "GeckoTerminal").length, dex: dexCount });
    setLoading(false);
    setFetchedOnce(true);
  };

  const visibleTokens = useMemo(() => {
    if (!searchText.trim()) return tokens;
    const q = searchText.trim().toLowerCase();
    return tokens.filter((t) => t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q));
  }, [tokens, searchText]);

  const handleCardClick = async (card: ChineseTokenCard) => {
    setFillingAddress(card.address);
    setError("");
    try {
      const enriched = await fetchTokenInfoByAddress(card.chain, card.address);
      const merged: GeckoTokenData = {
        ...enriched,
        name: enriched.name || card.name,
        symbol: enriched.symbol || card.symbol,
        volume24h: card.volume24h,
        priceUsd: card.priceUsd,
        fdv: null,
        poolCreatedAt: "",
        poolName: `${card.name}/${card.symbol}`,
      };
      onFillToken(merged, card.chain);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load this token's details");
    } finally {
      setFillingAddress(null);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-white">
            🇨🇳 Chinese Meme Tokens
          </p>
          <p className="text-[11px] text-gray-500">
            Tokens with Chinese characters in their name/symbol, across every chain Flap supports. Click one to fill the form below.
          </p>
        </div>
        <button
          type="button"
          onClick={handleFetch}
          disabled={loading}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
            loading ? "cursor-not-allowed bg-gray-700 text-gray-500" : "bg-red-700/80 text-white hover:bg-red-700"
          }`}
        >
          {loading ? "Scanning..." : fetchedOnce ? "🔄 Refresh" : "📡 Scan for Chinese Tokens"}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-gray-800 bg-gray-950/40 p-3 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label className="mb-1 block text-[10px] uppercase text-gray-500">Chain</label>
          <select
            value={chainFilter}
            onChange={(e) => setChainFilter(e.target.value)}
            className="w-full rounded-md border border-gray-700 bg-gray-800/60 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Flap Chains</option>
            {GECKO_CHAINS.map((c) => (
              <option key={c.key} value={c.key}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] uppercase text-gray-500">GeckoTerminal mode</label>
          <select
            value={geckoMode}
            onChange={(e) => setGeckoMode(e.target.value as "hot" | "new" | "both")}
            disabled={!useGecko}
            className="w-full rounded-md border border-gray-700 bg-gray-800/60 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500 disabled:opacity-40"
          >
            <option value="both">Hot + New</option>
            <option value="hot">Hot only</option>
            <option value="new">New only</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] uppercase text-gray-500">Min 24h volume ($)</label>
          <input
            type="number"
            min="0"
            value={minVolume}
            onChange={(e) => setMinVolume(e.target.value)}
            className="w-full rounded-md border border-gray-700 bg-gray-800/60 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] uppercase text-gray-500">Max age (days)</label>
          <input
            type="number"
            min="0"
            placeholder="No limit"
            value={maxAgeDays}
            onChange={(e) => setMaxAgeDays(e.target.value)}
            className="w-full rounded-md border border-gray-700 bg-gray-800/60 px-2 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] uppercase text-gray-500">Sort by</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "volume" | "change" | "newest")}
            className="w-full rounded-md border border-gray-700 bg-gray-800/60 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
          >
            <option value="volume">Highest volume</option>
            <option value="change">Biggest 1h gain</option>
            <option value="newest">Newest first</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] uppercase text-gray-500">Search name/symbol</label>
          <input
            type="text"
            placeholder="Filter results..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full rounded-md border border-gray-700 bg-gray-800/60 px-2 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-indigo-500"
          />
        </div>

        <div className="col-span-2 flex items-center gap-3 sm:col-span-3 lg:col-span-6">
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            <input type="checkbox" checked={useGecko} onChange={(e) => setUseGecko(e.target.checked)} className="accent-indigo-500" />
            GeckoTerminal
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            <input type="checkbox" checked={useDexScreener} onChange={(e) => setUseDexScreener(e.target.checked)} className="accent-indigo-500" />
            DexScreener
          </label>
          {fetchedOnce && !loading && (
            <span className="ml-auto text-[10px] text-gray-500">
              Found: {sourceCounts.gecko} from GeckoTerminal, {sourceCounts.dex} from DexScreener (before filters)
            </span>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-2 rounded-md border border-red-500/30 bg-red-950/30 px-3 py-2 text-xs text-red-300">{error}</p>
      )}

      {!fetchedOnce && !loading && !error && (
        <p className="rounded-md border border-dashed border-gray-800 px-3 py-4 text-center text-xs text-gray-500">
          Press &quot;Scan for Chinese Tokens&quot; to load results - scanning all chains and both sources in one click can take a few seconds, and nothing is fetched until you ask for it.
        </p>
      )}

      {visibleTokens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visibleTokens.map((t) => {
            const chainInfo = getChainByKey(t.chain);
            return (
              <button
                key={`${t.chain}-${t.address}`}
                type="button"
                onClick={() => handleCardClick(t)}
                disabled={fillingAddress === t.address}
                className="flex w-44 flex-shrink-0 flex-col items-start gap-1.5 rounded-lg border border-gray-800 bg-gray-950/60 p-3 text-left transition hover:border-red-500/50 hover:bg-gray-900 disabled:opacity-60"
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
                <p className="text-[10px] text-gray-600">
                  {chainInfo?.name || t.chain} · {t.source}
                </p>
                {fillingAddress === t.address && <p className="text-[10px] text-indigo-400">Loading details...</p>}
              </button>
            );
          })}
        </div>
      )}

      {fetchedOnce && !loading && visibleTokens.length === 0 && !error && (
        <p className="rounded-md border border-dashed border-gray-800 px-3 py-4 text-center text-xs text-gray-500">
          No Chinese-named tokens matched your filters right now. Try lowering the volume filter, widening the age limit, or scanning again shortly.
        </p>
      )}
    </div>
  );
}
