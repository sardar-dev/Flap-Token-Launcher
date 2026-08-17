import { NextRequest, NextResponse } from "next/server";
import { getChainByKey, GECKOTERMINAL_API_BASE } from "@/lib/chains";

// NOTE: as of this update, the primary path for the Trending Memecoins
// dashboard is src/lib/geckoterminal-client.ts, which calls GeckoTerminal
// directly from the visitor's browser. This route now exists as the
// automatic fallback for when that direct call fails.

interface GeckoPoolAttributes {
  name: string;
  pool_created_at: string;
  volume_usd: { h24: string };
  base_token_price_usd: string;
  price_change_percentage?: { h1?: string; h24?: string };
}

interface GeckoPool {
  id: string;
  attributes: GeckoPoolAttributes;
  relationships: {
    base_token: { data: { id: string; type: string } };
  };
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

const MAX_CARDS = 12;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

// This endpoint is only ever called when the person presses the dashboard's
// "Refresh" button (never on a timer/interval) - see TrendingDashboard.tsx.
// One call here = one call to GeckoTerminal, no background polling.
export async function GET(req: NextRequest) {
  try {
    const chainKey = req.nextUrl.searchParams.get("chain") || "BSC";
    const mode = req.nextUrl.searchParams.get("mode") === "new" ? "new" : "hot";
    const chainInfo = getChainByKey(chainKey);

    if (!chainInfo) {
      return NextResponse.json({ error: `Unknown chain "${chainKey}".` }, { status: 400 });
    }
    if (!chainInfo.geckoNetwork) {
      return NextResponse.json(
        { error: `Trending data isn't available for ${chainInfo.name} yet.` },
        { status: 404 }
      );
    }

    const network = chainInfo.geckoNetwork;
    const url =
      mode === "hot"
        ? `${GECKOTERMINAL_API_BASE}/networks/${network}/trending_pools?include=base_token`
        : `${GECKOTERMINAL_API_BASE}/networks/${network}/new_pools?include=base_token&page=1`;

    const res = await fetch(url, { headers: { Accept: "application/json" }, next: { revalidate: 0 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: `GeckoTerminal returned HTTP ${res.status} for ${chainInfo.name}. Try again shortly.` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const pools: GeckoPool[] = json.data || [];
    const included: GeckoToken[] = json.included || [];

    const tokenMap = new Map<string, GeckoToken>();
    for (const tok of included) tokenMap.set(tok.id, tok);

    const now = Date.now();
    const cards = pools
      .slice(0, MAX_CARDS)
      .map((pool) => {
        const baseTokenId = pool.relationships.base_token.data.id;
        const token = tokenMap.get(baseTokenId);
        if (!token) return null;

        const createdAt = pool.attributes.pool_created_at ? new Date(pool.attributes.pool_created_at).getTime() : now;
        const ageDays = Math.max(0, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)));

        return {
          address: token.attributes.address,
          name: token.attributes.name,
          symbol: token.attributes.symbol,
          imageUrl: token.attributes.image_url || "",
          priceUsd: parseFloat(pool.attributes.base_token_price_usd || "0"),
          priceChange1h: parseFloat(pool.attributes.price_change_percentage?.h1 || "0"),
          volume24h: parseFloat(pool.attributes.volume_usd?.h24 || "0"),
          ageDays,
          chain: chainInfo.key,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    return NextResponse.json({ success: true, chain: chainInfo.key, mode, tokens: cards });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Failed to fetch trending tokens";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
