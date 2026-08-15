export interface ChainInfo {
  key: string;
  name: string;
  currency: string;
  rpcUrl: string;
  explorer: string;
  explorerTx: (hash: string) => string;
  /**
   * GeckoTerminal network slug used by /api/gecko-token to scan trending
   * pools on the correct chain (see https://api.geckoterminal.com/api/v2/networks).
   * `null` means GeckoTerminal has no (or no reliable) pool data for this chain yet,
   * so AI Fill is disabled for it rather than silently falling back to BSC.
   */
  geckoNetwork: string | null;
}

export const SUPPORTED_CHAINS: ChainInfo[] = [
  {
    key: "BSC",
    name: "BNB Smart Chain",
    currency: "BNB",
    rpcUrl: "https://bsc-dataseed.binance.org",
    explorer: "https://bscscan.com",
    explorerTx: (h) => `https://bscscan.com/tx/${h}`,
    geckoNetwork: "bsc",
  },
  {
    key: "BASE",
    name: "Base",
    currency: "ETH",
    rpcUrl: "https://mainnet.base.org",
    explorer: "https://basescan.org",
    explorerTx: (h) => `https://basescan.org/tx/${h}`,
    geckoNetwork: "base",
  },
  {
    key: "ETHEREUM",
    name: "Ethereum",
    currency: "ETH",
    rpcUrl: "https://eth.llamarpc.com",
    explorer: "https://etherscan.io",
    explorerTx: (h) => `https://etherscan.io/tx/${h}`,
    geckoNetwork: "eth",
  },
  {
    key: "ARBITRUM_ONE",
    name: "Arbitrum One",
    currency: "ETH",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorer: "https://arbiscan.io",
    explorerTx: (h) => `https://arbiscan.io/tx/${h}`,
    geckoNetwork: "arbitrum",
  },
  {
    key: "XLAYER",
    name: "X Layer",
    currency: "OKB",
    rpcUrl: "https://xlayerrpc.okx.com",
    explorer: "https://www.okx.com/explorer/xlayer",
    explorerTx: (h) => `https://www.okx.com/explorer/xlayer/tx/${h}`,
    geckoNetwork: "x-layer",
  },
  {
    key: "MORPH",
    name: "Morph",
    currency: "ETH",
    rpcUrl: "https://rpc.morphl2.io",
    explorer: "https://explorer.morphl2.io",
    explorerTx: (h) => `https://explorer.morphl2.io/tx/${h}`,
    geckoNetwork: "morph-l2",
  },
  {
    key: "MONAD",
    name: "Monad",
    currency: "MON",
    rpcUrl: "https://rpc-mainnet.monadinfra.com",
    explorer: "https://monad.xyz/explorer",
    explorerTx: (h) => `https://monad.xyz/explorer/tx/${h}`,
    // GeckoTerminal's Monad mainnet slug is new and can change - verify at
    // https://api.geckoterminal.com/api/v2/networks if AI Fill errors on Monad.
    geckoNetwork: "monad",
  },
];

export const DEX_THRESH_OPTIONS = [
  { value: 1, label: "80% (Four Fifths)" },
  { value: 3, label: "95%" },
  { value: 4, label: "81%" },
  { value: 0, label: "66% (Two Thirds)" },
  { value: 2, label: "50% (Half)" },
  { value: 5, label: "1% (Testing)" },
];

export const MIGRATOR_OPTIONS = [
  { value: 0, label: "V3 Migrator (Uniswap/PancakeSwap V3)" },
  { value: 1, label: "V2 Migrator (Uniswap/PancakeSwap V2)" },
  { value: 3, label: "PCS Infinity CL Migrator" },
];

export function getChainByKey(key: string): ChainInfo | undefined {
  return SUPPORTED_CHAINS.find((c) => c.key === key);
}
