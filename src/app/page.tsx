"use client";

import { useState } from "react";
import LauncherForm from "@/components/LauncherForm";
import Image from "next/image";

export default function HomePage() {
  const [launchCount, setLaunchCount] = useState(0);

  return (
    <div className="min-h-screen">
      {/* Hero Section with SEO Content */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/flap-hero.png"
            alt="Flap Token Launcher - Deploy tokens on Flap Protocol"
            fill
            className="object-cover opacity-40"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/60 via-gray-950/80 to-gray-950" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-12 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-600/20 backdrop-blur-sm">
              <span className="text-3xl">🚀</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white sm:text-4xl">
                Flap Token Launcher
              </h1>
              <p className="text-sm text-indigo-300">
                Deploy Tokens on Flap Protocol
              </p>
            </div>
          </div>
          
          {/* SEO-rich description */}
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-gray-300 sm:text-lg">
            <strong>Flap Token Launcher</strong> is the easiest way to deploy your own token on{" "}
            <a href="https://flap.sh" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">
              Flap Protocol
            </a>
            . Launch meme coins and tokens on <strong>BSC</strong>, <strong>Base</strong>,{" "}
            <strong>Ethereum</strong>, <strong>Monad</strong> and more chains with built-in{" "}
            <em>bonding curve pricing</em>, <em>automatic DEX migration</em>, and optional <em>tax support</em>.
          </p>

          {/* Feature Stats */}
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 backdrop-blur-sm">
              <span className="text-indigo-300">🌐</span>
              <span className="ml-2 font-bold text-white">7 Chains</span>
              <span className="ml-1 text-gray-400">Supported</span>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 backdrop-blur-sm">
              <span className="text-emerald-300">📈</span>
              <span className="ml-2 font-bold text-white">CDPV2</span>
              <span className="ml-1 text-gray-400">Bonding Curve</span>
            </div>
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-2 backdrop-blur-sm">
              <span className="text-purple-300">🔄</span>
              <span className="ml-2 font-bold text-white">Auto</span>
              <span className="ml-1 text-gray-400">DEX Migration</span>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 backdrop-blur-sm">
              <span className="text-amber-300">💸</span>
              <span className="ml-2 font-bold text-white">Tax</span>
              <span className="ml-1 text-gray-400">Support</span>
            </div>
            {launchCount > 0 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 backdrop-blur-sm">
                <span className="text-emerald-300">✅</span>
                <span className="ml-2 font-bold text-white">{launchCount}</span>
                <span className="ml-1 text-gray-400">Launched</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
        {/* Launcher Form */}
        <section aria-label="Token Launch Form">
          <div className="rounded-2xl border border-gray-800 bg-gray-900/80 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white">
                Deploy Your Token on Flap Protocol
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                Fill in the details below to launch your token. Use the <strong className="text-violet-400">AI Fill</strong> button to auto-populate with trending token data.
              </p>
            </div>
            <LauncherForm
              onLaunchComplete={() => setLaunchCount((c) => c + 1)}
            />
          </div>
        </section>

        {/* SEO Feature Cards */}
        <section className="mt-16" aria-label="Features">
          <h2 className="mb-8 text-center text-2xl font-bold text-white">
            Why Use Flap Token Launcher?
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/10">
                <span className="text-2xl">🔗</span>
              </div>
              <h3 className="text-lg font-semibold text-white">Multi-Chain Support</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Deploy your token on <strong>BSC</strong>, <strong>Base</strong>, <strong>Ethereum</strong>,{" "}
                <strong>Arbitrum</strong>, <strong>X Layer</strong>, <strong>Morph</strong>, and <strong>Monad</strong>{" "}
                with a single unified interface.
              </p>
            </article>
            
            <article className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                <span className="text-2xl">📈</span>
              </div>
              <h3 className="text-lg font-semibold text-white">CDPV2 Bonding Curve</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Flap Protocol uses an advanced <strong>bonding curve</strong> for fair price discovery.
                Token price increases automatically as demand grows.
              </p>
            </article>
            
            <article className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-lg font-semibold text-white">Auto DEX Migration</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                When your token reaches the graduation threshold, it automatically migrates to{" "}
                <strong>PancakeSwap V3</strong>, <strong>Uniswap</strong>, or other DEXes.
              </p>
            </article>
            
            <article className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
                <span className="text-2xl">💸</span>
              </div>
              <h3 className="text-lg font-semibold text-white">Optional Tax Support</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Configure buy/sell taxes in basis points. Set 0 for no tax, or up to 10000 (100%) for maximum.
              </p>
            </article>
            
            <article className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-violet-500/10">
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="text-lg font-semibold text-white">AI-Powered Fill</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                One-click auto-fill from trending BSC tokens. Gets name, symbol, image, and metadata automatically.
              </p>
            </article>
            
            <article className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500/10">
                <span className="text-2xl">🖼️</span>
              </div>
              <h3 className="text-lg font-semibold text-white">Auto Image Upload</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Token images are automatically uploaded to permanent hosting. No API keys or setup required.
              </p>
            </article>
          </div>
        </section>

        {/* How It Works */}
        <section className="mt-16" aria-label="How It Works">
          <h2 className="mb-8 text-center text-2xl font-bold text-white">
            How It Works
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-lg font-bold text-indigo-400">
                1
              </div>
              <h3 className="font-semibold text-white">Fill Details</h3>
              <p className="mt-1 text-xs text-gray-400">Enter token name, symbol, and optional settings</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-lg font-bold text-indigo-400">
                2
              </div>
              <h3 className="font-semibold text-white">Add Private Key</h3>
              <p className="mt-1 text-xs text-gray-400">Your deployer wallet key (never stored)</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-lg font-bold text-indigo-400">
                3
              </div>
              <h3 className="font-semibold text-white">Click Launch</h3>
              <p className="mt-1 text-xs text-gray-400">We generate vanity salt & deploy</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-lg font-bold text-emerald-400">
                ✓
              </div>
              <h3 className="font-semibold text-white">Done!</h3>
              <p className="mt-1 text-xs text-gray-400">Your token is live on Flap</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 border-t border-gray-800 pt-8 text-center">
          <p className="text-sm text-gray-500">
            Built for{" "}
            <a href="https://flap.sh" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">
              Flap Protocol
            </a>
            {" "}• No database required • No API keys needed
          </p>
          <p className="mt-2 text-xs text-gray-600">
            ⚠️ This tool handles private keys client-side. Use a dedicated deployment wallet.
          </p>
        </footer>
      </main>
    </div>
  );
}
