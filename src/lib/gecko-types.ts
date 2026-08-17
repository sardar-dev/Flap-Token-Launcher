export interface GeckoTokenData {
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

export interface TrendingTokenCard {
  address: string;
  name: string;
  symbol: string;
  imageUrl: string;
  priceUsd: number;
  priceChange1h: number;
  volume24h: number;
  ageDays: number;
  chain: string;
}
