"use client";

import { SUPPORTED_CHAINS } from "@/lib/chains";
import type { TrendingTokenCard } from "@/lib/gecko-types";
import { containsChinese } from "@/lib/cjk";

// DexScreener's public REST API - confirmed free, no key/signup required
// (https://docs.dexscreener.com). Called directly from the browser, same
// reasoning as src/lib/geckoterminal-client.ts: each visitor uses their own
// slice of DexScreener's rate limit instead of sharing the server's.
const DEXSCREENER_BASE = "https://api.dexscreener.com";

interface DexTokenProfile {
  chainId: string;
  tokenAddress: string;
  icon?: string;
}

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

function chainKeyForDexscreenerId(dsChainId: string): string | null {
  const match = SUPPORTED_CHAINS.find((c) => c.dexscreenerChainId === dsChainId);
  return match ? match.key : null;
}

/**
 * Scans DexScreener's latest token profiles (a real-time feed of newly
 * promoted tokens), keeps only ones on the given chains, looks up each
 * candidate's actual name/symbol/price, and returns only the ones whose
 * name or symbol contains Chinese characters.
 *
 * Two-step because DexScreener's profile feed doesn't include name/symbol
 * directly - only after resolving the address do we know what to filter on.
 */
export async function fetchDexScreenerChineseTokens(chainKeys: string[]): Promise<TrendingTokenCard[]> {
  const targetDsIds = new Set(
    chainKeys
      .map((k) => SUPPORTED_CHAINS.find((c) => c.key === k)?.dexscreenerChainId)
      .filter((id): id is string => !!id)
  );
  if (targetDsIds.size === 0) return [];

  let profiles: DexTokenProfile[] = [];
  try {
    const res = await fetch(`${DEXSCREENER_BASE}/token-profiles/latest/v1`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = await res.json();
    profiles = Array.isArray(json) ? json : [];
  } catch {
    return []; // DexScreener source unavailable - GeckoTerminal source still covers the dashboard
  }

  const candidates = profiles.filter((p) => p?.chainId && p?.tokenAddress && targetDsIds.has(p.chainId));
  if (candidates.length === 0) return [];

  // Group by chain (DexScreener's batch lookup is per-chain, up to 30 addresses)
  const byChain = new Map<string, string[]>();
  for (const c of candidates) {
    const list = byChain.get(c.chainId) || [];
    if (list.length < 30) list.push(c.tokenAddress);
    byChain.set(c.chainId, list);
  }

  const results: TrendingTokenCard[] = [];
  const now = Date.now();

  for (const [dsChainId, addresses] of byChain.entries()) {
    const chainKey = chainKeyForDexscreenerId(dsChainId);
    if (!chainKey) continue;
    try {
      const res = await fetch(`${DEXSCREENER_BASE}/tokens/v1/${dsChainId}/${addresses.join(",")}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const pairs: DexPair[] = await res.json();
      if (!Array.isArray(pairs)) continue;

      for (const pair of pairs) {
        const name = pair.baseToken?.name || "";
        const symbol = pair.baseToken?.symbol || "";
        if (!containsChinese(name) && !containsChinese(symbol)) continue;

        const ageDays = pair.pairCreatedAt ? Math.max(0, Math.floor((now - pair.pairCreatedAt) / (1000 * 60 * 60 * 24))) : 0;

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
      // Skip this chain's DexScreener results on failure, keep going with the rest.
      continue;
    }
  }

  return results;
}
