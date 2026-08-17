"use client";

import { getChainByKey, AI_FILL_MIN_VOLUME_USD, GECKOTERMINAL_API_BASE } from "@/lib/chains";
import type { GeckoTokenData, TrendingTokenCard } from "@/lib/gecko-types";

// ---------------------------------------------------------------------------
// These functions call GeckoTerminal's public API directly from the
// visitor's own browser instead of relaying through our server.
//
// Why: GeckoTerminal's free public API allows only 30 calls/minute, and that
// limit applies per caller. If our server made every call, every visitor to
// this app would share ONE 30-calls/minute budget through our server's IP -
// meaning a handful of people using AI Fill or the Trending dashboard around
// the same time could rate-limit each other. Calling directly from each
// visitor's browser gives each person their own independent budget, and
// removes this traffic from our server entirely.
//
// Each function tries the direct browser call first. If that fails for any
// reason (an unusual network/CORS setup, GeckoTerminal being briefly down,
// etc.), it silently falls back to our own API route, which does the same
// work server-side. So this is a pure improvement with no loss of
// reliability - worst case, behavior is identical to before.
// ---------------------------------------------------------------------------

interface GeckoPoolAttributes {
  name: string;
  pool_created_at: string;
  volume_usd: { h24: string };
  base_token_price_usd: string;
  fdv_usd: string | null;
  price_change_percentage?: { h1?: string; h24?: string };
}

interface GeckoPool {
  id: string;
  attributes: GeckoPoolAttributes;
  relationships: { base_token: { data: { id: string; type: string } } };
}

interface GeckoTokenAttributes {
  address: string;
  name: string;
  symbol: string;
  image_url: string | null;
}

interface GeckoToken {
  id: string;
  attributes: GeckoTokenAttributes;
}

interface GeckoTokenInfoAttributes extends GeckoTokenAttributes {
  websites: string[];
  telegram_handle: string | null;
  twitter_handle: string | null;
  description: string | null;
  image: { thumb: string | null; small: string | null; large: string | null };
}

interface GeckoTokenInfoResponse {
  data: { attributes: GeckoTokenInfoAttributes };
}

function buildTokenDataFromInfo(attrs: GeckoTokenInfoAttributes): GeckoTokenData {
  return {
    name: attrs.name,
    symbol: attrs.symbol,
    address: attrs.address,
    description: attrs.description || "",
    imageUrl: attrs.image?.large || attrs.image?.small || attrs.image?.thumb || attrs.image_url || "",
    websites: attrs.websites || [],
    twitter: attrs.twitter_handle || "",
    telegram: attrs.telegram_handle || "",
    volume24h: 0,
    priceUsd: 0,
    fdv: null,
    poolCreatedAt: "",
    poolName: "",
  };
}

/** Random qualifying trending token for the AI Fill button. */
export async function fetchAiFillToken(chainKey: string): Promise<GeckoTokenData> {
  const chainInfo = getChainByKey(chainKey);
  if (!chainInfo?.geckoNetwork) {
    throw new Error(`AI Fill isn't available for this chain yet.`);
  }
  const network = chainInfo.geckoNetwork;

  try {
    const allQualifying: Array<{ pool: GeckoPool; token: GeckoToken }> = [];

    for (let page = 1; page <= 3; page++) {
      const res = await fetch(
        `${GECKOTERMINAL_API_BASE}/networks/${network}/new_pools?include=base_token&page=${page}`,
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) continue;
      const json = await res.json();
      const pools: GeckoPool[] = json.data || [];
      const included: GeckoToken[] = json.included || [];
      const tokenMap = new Map<string, GeckoToken>();
      for (const t of included) tokenMap.set(t.id, t);

      for (const pool of pools) {
        const vol24 = parseFloat(pool.attributes.volume_usd?.h24 || "0");
        if (vol24 >= AI_FILL_MIN_VOLUME_USD) {
          const token = tokenMap.get(pool.relationships.base_token.data.id);
          if (token) allQualifying.push({ pool, token });
        }
      }
      if (allQualifying.length >= 10) break;
    }

    if (allQualifying.length === 0) {
      throw new Error(`No ${chainInfo.name} tokens found with $${AI_FILL_MIN_VOLUME_USD}+ volume right now. Try again or pick another chain.`);
    }

    const picked = allQualifying[Math.floor(Math.random() * allQualifying.length)];
    const address = picked.token.attributes.address;

    const infoRes = await fetch(`${GECKOTERMINAL_API_BASE}/networks/${network}/tokens/${address}/info`, {
      headers: { Accept: "application/json" },
    });

    const base: GeckoTokenData = {
      name: picked.token.attributes.name,
      symbol: picked.token.attributes.symbol,
      address,
      description: "",
      imageUrl: picked.token.attributes.image_url || "",
      websites: [],
      twitter: "",
      telegram: "",
      volume24h: parseFloat(picked.pool.attributes.volume_usd?.h24 || "0"),
      priceUsd: parseFloat(picked.pool.attributes.base_token_price_usd || "0"),
      fdv: picked.pool.attributes.fdv_usd ? parseFloat(picked.pool.attributes.fdv_usd) : null,
      poolCreatedAt: picked.pool.attributes.pool_created_at,
      poolName: picked.pool.attributes.name,
    };

    if (infoRes.ok) {
      const infoJson: GeckoTokenInfoResponse = await infoRes.json();
      const attrs = infoJson.data.attributes;
      return {
        ...base,
        description: attrs.description || "",
        imageUrl: attrs.image?.large || attrs.image?.small || attrs.image?.thumb || attrs.image_url || base.imageUrl,
        websites: attrs.websites || [],
        twitter: attrs.twitter_handle || "",
        telegram: attrs.telegram_handle || "",
      };
    }
    return base;
  } catch {
    // Direct browser call failed (network/CORS/GeckoTerminal hiccup) - fall
    // back to our server route, which does the same thing.
    const res = await fetch(`/api/gecko-token?chain=${encodeURIComponent(chainKey)}`);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Failed to fetch token data");
    return data.token;
  }
}

/** Full details (description/socials/image) for one specific token address. */
export async function fetchTokenInfoByAddress(chainKey: string, address: string): Promise<GeckoTokenData> {
  const chainInfo = getChainByKey(chainKey);
  if (!chainInfo?.geckoNetwork) {
    throw new Error(`Details aren't available for this chain yet.`);
  }
  try {
    const res = await fetch(
      `${GECKOTERMINAL_API_BASE}/networks/${chainInfo.geckoNetwork}/tokens/${address}/info`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: GeckoTokenInfoResponse = await res.json();
    return buildTokenDataFromInfo(json.data.attributes);
  } catch {
    const res = await fetch(
      `/api/gecko-token?chain=${encodeURIComponent(chainKey)}&address=${encodeURIComponent(address)}`
    );
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Failed to load this token's details");
    return data.token;
  }
}

/** Trending Memecoins dashboard: a batch of cards for one chain, Hot or New. */
export async function fetchTrendingTokens(chainKey: string, mode: "hot" | "new"): Promise<TrendingTokenCard[]> {
  const chainInfo = getChainByKey(chainKey);
  if (!chainInfo?.geckoNetwork) {
    throw new Error(`Trending data isn't available for this chain yet.`);
  }
  const network = chainInfo.geckoNetwork;
  const MAX_CARDS = 12;

  try {
    const url =
      mode === "hot"
        ? `${GECKOTERMINAL_API_BASE}/networks/${network}/trending_pools?include=base_token`
        : `${GECKOTERMINAL_API_BASE}/networks/${network}/new_pools?include=base_token&page=1`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const pools: GeckoPool[] = json.data || [];
    const included: GeckoToken[] = json.included || [];
    const tokenMap = new Map<string, GeckoToken>();
    for (const t of included) tokenMap.set(t.id, t);

    const now = Date.now();
    const cards: TrendingTokenCard[] = [];
    for (const pool of pools.slice(0, MAX_CARDS)) {
      const token = tokenMap.get(pool.relationships.base_token.data.id);
      if (!token) continue;
      const createdAt = pool.attributes.pool_created_at ? new Date(pool.attributes.pool_created_at).getTime() : now;
      const ageDays = Math.max(0, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)));
      cards.push({
        address: token.attributes.address,
        name: token.attributes.name,
        symbol: token.attributes.symbol,
        imageUrl: token.attributes.image_url || "",
        priceUsd: parseFloat(pool.attributes.base_token_price_usd || "0"),
        priceChange1h: parseFloat(pool.attributes.price_change_percentage?.h1 || "0"),
        volume24h: parseFloat(pool.attributes.volume_usd?.h24 || "0"),
        ageDays,
        chain: chainInfo.key,
      });
    }
    return cards;
  } catch {
    const res = await fetch(`/api/trending-tokens?chain=${encodeURIComponent(chainKey)}&mode=${mode}`);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Failed to fetch trending tokens");
    return data.tokens || [];
  }
}
