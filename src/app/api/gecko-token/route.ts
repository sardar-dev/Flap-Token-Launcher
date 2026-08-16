import { NextRequest, NextResponse } from "next/server";
import { getChainByKey } from "@/lib/chains";

interface GeckoPoolAttributes {
  name: string;
  pool_created_at: string;
  volume_usd: {
    h24: string;
  };
  base_token_price_usd: string;
  fdv_usd: string | null;
  reserve_in_usd: string;
}

interface GeckoPool {
  id: string;
  type: string;
  attributes: GeckoPoolAttributes;
  relationships: {
    base_token: {
      data: { id: string; type: string };
    };
  };
}

interface GeckoTokenAttributes {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  image_url: string | null;
  coingecko_coin_id: string | null;
}

interface GeckoToken {
  id: string;
  type: string;
  attributes: GeckoTokenAttributes;
}

interface GeckoTokenInfoAttributes extends GeckoTokenAttributes {
  websites: string[];
  discord_url: string | null;
  telegram_handle: string | null;
  twitter_handle: string | null;
  description: string | null;
  image: {
    thumb: string | null;
    small: string | null;
    large: string | null;
  };
}

interface GeckoTokenInfoResponse {
  data: {
    id: string;
    type: string;
    attributes: GeckoTokenInfoAttributes;
  };
}

const GECKO_BASE = "https://api.geckoterminal.com/api/v2";
const MIN_VOLUME = 200;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const chainKey = req.nextUrl.searchParams.get("chain") || "BSC";
    const directAddress = req.nextUrl.searchParams.get("address");
    const chainInfo = getChainByKey(chainKey);

    if (!chainInfo) {
      return NextResponse.json(
        { error: `Unknown chain "${chainKey}".` },
        { status: 400 }
      );
    }

    if (!chainInfo.geckoNetwork) {
      return NextResponse.json(
        {
          error: `AI Fill isn't available for ${chainInfo.name} yet (no GeckoTerminal trending data for this network). Fill in the token details manually.`,
        },
        { status: 404 }
      );
    }

    const network = chainInfo.geckoNetwork;

    // Direct lookup mode: used when the person clicks a specific token in the
    // Trending Memecoins dashboard. We already have its name/symbol/price/
    // volume from that dashboard fetch (no need to re-fetch those), so this
    // only pulls the richer info (description, socials, higher-res image)
    // for the ONE token that was clicked - one extra API call, not a rescan.
    if (directAddress) {
      const infoRes = await fetch(
        `${GECKO_BASE}/networks/${network}/tokens/${directAddress}/info`,
        { headers: { Accept: "application/json" }, next: { revalidate: 0 } }
      );
      if (!infoRes.ok) {
        return NextResponse.json({ error: `Could not load details for this token (HTTP ${infoRes.status}).` }, { status: 502 });
      }
      const infoJson: GeckoTokenInfoResponse = await infoRes.json();
      const attrs = infoJson.data.attributes;

      return NextResponse.json({
        success: true,
        token: {
          name: attrs.name,
          symbol: attrs.symbol,
          address: attrs.address,
          description: attrs.description || "",
          imageUrl: attrs.image?.large || attrs.image?.small || attrs.image?.thumb || attrs.image_url || "",
          websites: attrs.websites || [],
          twitter: attrs.twitter_handle || "",
          telegram: attrs.telegram_handle || "",
          chain: chainInfo.key,
        },
      });
    }

    const allQualifying: Array<{
      pool: GeckoPool;
      token: GeckoToken;
    }> = [];

    // Scan pages for qualifying tokens - always on the currently selected chain's network
    for (let page = 1; page <= 3; page++) {
      const url = `${GECKO_BASE}/networks/${network}/new_pools?include=base_token&page=${page}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        next: { revalidate: 0 },
      });

      if (!res.ok) continue;

      const json = await res.json();
      const pools: GeckoPool[] = json.data || [];
      const included: GeckoToken[] = json.included || [];

      const tokenMap = new Map<string, GeckoToken>();
      for (const tok of included) {
        tokenMap.set(tok.id, tok);
      }

      for (const pool of pools) {
        const vol24 = parseFloat(pool.attributes.volume_usd?.h24 || "0");
        if (vol24 >= MIN_VOLUME) {
          const baseTokenId = pool.relationships.base_token.data.id;
          const token = tokenMap.get(baseTokenId);
          if (token) {
            allQualifying.push({ pool, token });
          }
        }
      }

      if (allQualifying.length >= 10) break;
      await new Promise((r) => setTimeout(r, 300));
    }

    if (allQualifying.length === 0) {
      return NextResponse.json(
        {
          error: `No ${chainInfo.name} tokens found with $${MIN_VOLUME}+ volume right now. Try again or pick another chain.`,
        },
        { status: 404 }
      );
    }

    // Pick random
    const randomIndex = Math.floor(Math.random() * allQualifying.length);
    const picked = allQualifying[randomIndex];

    const tokenAddress = picked.token.attributes.address;
    const tokenName = picked.token.attributes.name;
    const tokenSymbol = picked.token.attributes.symbol;

    // Get extended info including image
    let description = "";
    let imageUrl = picked.token.attributes.image_url || "";
    let websites: string[] = [];
    let twitter = "";
    let telegram = "";

    try {
      const infoRes = await fetch(
        `${GECKO_BASE}/networks/${network}/tokens/${tokenAddress}/info`,
        {
          headers: { Accept: "application/json" },
          next: { revalidate: 0 },
        }
      );
      if (infoRes.ok) {
        const infoJson: GeckoTokenInfoResponse = await infoRes.json();
        const attrs = infoJson.data.attributes;
        description = attrs.description || "";
        // Prioritize larger images
        imageUrl = attrs.image?.large || attrs.image?.small || attrs.image?.thumb || attrs.image_url || imageUrl;
        websites = attrs.websites || [];
        twitter = attrs.twitter_handle || "";
        telegram = attrs.telegram_handle || "";
      }
    } catch {
      // Continue without extended info
    }

    const vol24 = parseFloat(picked.pool.attributes.volume_usd?.h24 || "0");
    const priceUsd = parseFloat(picked.pool.attributes.base_token_price_usd || "0");
    const fdv = picked.pool.attributes.fdv_usd
      ? parseFloat(picked.pool.attributes.fdv_usd)
      : null;

    return NextResponse.json({
      success: true,
      token: {
        name: tokenName,
        symbol: tokenSymbol,
        address: tokenAddress,
        // NOTE: intentionally no `metaCid` here. There is no such thing as a
        // "borrowed" metadata CID - Flap resolves `meta` to real pinned IPFS
        // content, so reusing another token's address as a fake CID string
        // (as this endpoint used to do) produces a CID that resolves to
        // nothing and the image never shows on Flap. The launch endpoint
        // uploads a real metadata CID for *your* image at deploy time.
        description,
        imageUrl, // Include the token image URL as inspiration/reference
        websites,
        twitter,
        telegram,
        volume24h: vol24,
        priceUsd,
        fdv,
        poolCreatedAt: picked.pool.attributes.pool_created_at,
        poolName: picked.pool.attributes.name,
        chain: chainInfo.key,
      },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Failed to fetch token data";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
