"use client";

import { SUPPORTED_CHAINS } from "@/lib/chains";
import type { TrendingTokenCard } from "@/lib/gecko-types";
import { containsChinese } from "@/lib/cjk";

// DexScreener's public REST API - confirmed free, no key/signup required
// (https://docs.dexscreener.com). Called directly from the browser, same
// reasoning as src/lib/geckoterminal-client.ts: each visitor uses their own
// slice of DexScreener's rate limit instead of sharing the server's.
const DEXSCREENER_BASE = "https://api.dexscreener.com";

interface DexPairToken {
  address: string;
  name?: string;
  symbol?: string;
}

interface DexPair {
  chainId: string;
  baseToken: DexPairToken;
  priceUsd?: string;
  volume?: { h24?: number };
  priceChange?: { h1?: number };
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
}

interface DexSearchResponse {
  pairs?: DexPair[];
}

function chainKeyForDexscreenerId(dsChainId: string): string | null {
  const match = SUPPORTED_CHAINS.find((c) => c.dexscreenerChainId === dsChainId);
  return match ? match.key : null;
}

// Common Chinese words/characters used in meme/crypto token names and
// symbols - zodiac animals, "coin"/"currency", luck/wealth words, and common
// bull-market slang. DexScreener's search matches substrings of token name
// and symbol, so searching these directly finds Chinese-named tokens instead
// of hoping they happen to appear in a general trending/new list.
const CHINESE_SEARCH_KEYWORDS = [
  "币", "龙", "牛", "狗", "猫", "虎", "兔", "鸡", "猪", "马",
  "涨", "赚", "发财", "福", "财", "金", "银", "旺", "牛市", "神",
];

/**
 * Searches DexScreener directly for Chinese meme-coin keywords (rather than
 * filtering their small "paid profile" feed), one search call per keyword,
 * keeps only pairs on the requested chains, and double-checks the actual
 * name/symbol contains Chinese characters (a keyword match can occasionally
 * land in unrelated fields).
 */
export async function fetchDexScreenerChineseTokens(chainKeys: string[]): Promise<TrendingTokenCard[]> {
  const targetDsIds = new Set(
    chainKeys
      .map((k) => SUPPORTED_CHAINS.find((c) => c.key === k)?.dexscreenerChainId)
      .filter((id): id is string => !!id)
  );
  if (targetDsIds.size === 0) return [];

  const results: TrendingTokenCard[] = [];
  const seen = new Set<string>();
  const now = Date.now();

  for (const keyword of CHINESE_SEARCH_KEYWORDS) {
    try {
      const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(keyword)}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const json: DexSearchResponse = await res.json();
      const pairs = Array.isArray(json.pairs) ? json.pairs : [];

      for (const pair of pairs) {
        if (!targetDsIds.has(pair.chainId)) continue;
        const chainKey = chainKeyForDexscreenerId(pair.chainId);
        if (!chainKey) continue;

        const name = pair.baseToken?.name || "";
        const symbol = pair.baseToken?.symbol || "";
        if (!containsChinese(name) && !containsChinese(symbol)) continue;

        const dedupeKey = `${chainKey}:${pair.baseToken.address.toLowerCase()}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const ageDays = pair.pairCreatedAt
          ? Math.max(0, Math.floor((now - pair.pairCreatedAt) / (1000 * 60 * 60 * 24)))
          : 0;

        results.push({
          address: pair.baseToken.address,
          name,
          symbol,
          imageUrl: pair.info?.imageUrl || "",
          priceUsd: parseFloat(pair.priceUsd || "0"),
          priceChange1h: pair.priceChange?.h1 ?? 0,
          volume24h: pair.volume?.h24 ?? 0,
          ageDays,
          chain: chainKey,
        });
      }
    } catch {
      // Skip this keyword on failure, keep going with the rest.
      continue;
    }
  }

  return results;
}
