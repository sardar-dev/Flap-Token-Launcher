# Flap Token Launcher

Deploy your own tokens on [Flap Protocol](https://flap.sh) with bonding curve pricing, automatic DEX migration, and optional tax support.

**No database required.**

## Features

- **Multi-Chain Support**: BSC, Base, Ethereum, Arbitrum, X Layer, Morph, and Monad
- **CDPV2 Bonding Curve**: Fair price discovery with automatic price increases
- **Auto DEX Migration**: Automatic migration to PancakeSwap V3, Uniswap, etc.
- **Tax Support**: Optional configurable tax rates (in basis points)
- **AI Fill**: Auto-populate token data from trending tokens *on your currently selected target chain* (BSC, Base, Ethereum, etc. - not always BSC)
- **Real IPFS metadata**: Images and metadata are pinned through Flap's own official upload API so they actually display on flap.sh
- **Automatic fallback**: If `newTokenV3` reverts, the launcher automatically retries with `newTokenV2`
- **Zero required configuration**: Works out of the box with no environment variables; one optional variable (`PINATA_JWT`) adds a backup IPFS pinning path

## Deployment

### Vercel (recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sardar-dev/Flap-Token-Launcher)

1. Fork this repository
2. Import to Vercel
3. Deploy - no environment variables required (optionally set `PINATA_JWT`, see [Image & Metadata Handling](#image--metadata-handling))

`src/app/api/launch/route.ts` sets `export const maxDuration = 60` (vanity-salt search can take up to ~60s). The Hobby plan caps function duration at 60s; if you're on Hobby and see timeouts, upgrade to Pro or reduce salt search iterations.

### Cloudflare Pages

Cloudflare Pages runs Next.js API routes on the Workers **edge runtime**, not Node.js, via [`@cloudflare/next-on-pages`](https://github.com/cloudflare/next-on-pages). To deploy here:

1. `npm install --save-dev @cloudflare/next-on-pages`
2. In each `route.ts` under `src/app/api/`, change `export const runtime = "nodejs"` to `export const runtime = "edge"`
3. Build with `npx @cloudflare/next-on-pages` and deploy the `.vercel/output/static` directory, or connect the repo directly in the Cloudflare dashboard with build command `npx @cloudflare/next-on-pages`

**Known limitation**: vanity-salt generation runs up to 1,000,000 keccak256 hashing iterations synchronously. This is fine on Vercel/Node, but Cloudflare Workers on the free tier cap CPU time per request (typically ~10-50ms); a real salt search can exceed that and get killed. If you deploy to Cloudflare, either use a Workers Paid/Unbound plan (higher CPU limits) or lower `maxIterations` in `src/app/api/launch/route.ts`'s `findSaltEndingByChain` call, accepting that some launches may not find a valid vanity address in time.

### Any Node.js hosting (Railway, Render, a VPS, etc.)

This is a standard Next.js app - no special configuration needed beyond Node.js 18.18+:

```bash
npm install
npm run build
npm start
```

The app listens on `PORT` (default 3000) per Next.js conventions.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the launcher.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4
- **Blockchain**: ethers.js + four-flap-meme-sdk
- **On-chain data for AI Fill**: GeckoTerminal public API

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── gecko-token/   # AI token data from GeckoTerminal, scoped to the selected chain
│   │   ├── launch/        # Token deployment endpoint (upload + salt search + tx dispatch)
│   │   ├── upload-image/  # Optional preview-image re-hosting (UI only, not what Flap displays)
│   │   └── health/        # Health check
│   ├── page.tsx           # Main launcher UI
│   └── layout.tsx         # Root layout with SEO
├── components/
│   └── LauncherForm.tsx   # Token launch form
└── lib/
    └── chains.ts          # Supported chains config (RPC, explorer, GeckoTerminal network slug)
```

## How It Works

1. **Fill Details**: Enter token name, symbol, image URL, and optional settings (or use AI Fill)
2. **Add Private Key**: Your deployer wallet key (used server-side to sign the transaction, never persisted to disk or a database)
3. **Click Launch**: The app pins your image + metadata to IPFS, generates a vanity salt, and deploys
4. **Done!**: Your token is live on Flap Protocol

### Image & Metadata Handling

Flap only displays a token's image if its metadata JSON is pinned on **Flap's own IPFS gateway** - per Flap's docs, "our indexer will not be able to fetch your file if it is not pinned on our gateway." This app pins through Flap's official upload API (`https://funcs.flap.sh/api/upload`), which requires no API key.

If you set the optional `PINATA_JWT` environment variable (free tier at [pinata.cloud](https://app.pinata.cloud/developers/api-keys)), the app retries via Pinata as a backup if Flap's own API is briefly unavailable. Note this pins to Pinata's gateway, not Flap's own - per Flap's docs this may be picked up more slowly by their indexer, or not at all.

If both uploads fail and you didn't provide your own metadata CID, the launcher now surfaces a clear error instead of silently launching with a placeholder - a token with no real pinned metadata will never show an image or description on Flap regardless of what the launcher does, so failing loudly here is the correct behavior.

### Metadata CID field

- Leave empty and provide an image URL - a real CID is generated automatically at launch time.
- Or paste in a CID you've already pinned yourself.
- AI Fill fills in a *reference* image/description from a trending token as a starting point - it never fabricates a CID, since there's no such thing as a valid "example" CID borrowed from an unrelated token.

## Security

- Private keys are processed server-side but never stored
- Use a dedicated deployment wallet with minimal funds
- All transactions require your explicit private key

## Supported Chains

| Chain | Currency | DEX | AI Fill source |
|-------|----------|-----|-----------------|
| BSC | BNB | PancakeSwap | GeckoTerminal `bsc` |
| Base | ETH | Uniswap | GeckoTerminal `base` |
| Ethereum | ETH | Uniswap | GeckoTerminal `eth` |
| Arbitrum | ETH | Uniswap | GeckoTerminal `arbitrum` |
| X Layer | OKB | - | GeckoTerminal `x-layer` |
| Morph | ETH | - | GeckoTerminal `morph-l2` |
| Monad | MON | - | GeckoTerminal `monad` |

AI Fill always scans the chain currently selected in the form, not BSC by default.

## License

MIT
