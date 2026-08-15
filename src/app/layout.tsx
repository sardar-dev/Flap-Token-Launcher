import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flap Token Launcher | Deploy Tokens on Flap Protocol BSC, Base, Monad",
  description:
    "Launch your own token on Flap Protocol with our easy-to-use Flap Token Launcher. Deploy meme tokens on BSC, Base, Ethereum, Monad & more chains with bonding curve, auto DEX migration, and tax support. No coding required.",
  keywords: [
    "Flap Token Launcher",
    "Flap Protocol",
    "token launcher",
    "meme token creator",
    "BSC token launch",
    "bonding curve token",
    "PancakeSwap token",
    "create crypto token",
    "deploy token BSC",
    "Flap meme coin",
    "token deployer",
    "no code token launch",
    "Base token launcher",
    "Monad token launcher",
    "CDPV2 bonding curve",
    "auto liquidity token",
    "fair launch token",
  ],
  authors: [{ name: "Flap Token Launcher" }],
  creator: "Flap Token Launcher",
  publisher: "Flap Token Launcher",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://flap-token-launcher.vercel.app",
    siteName: "Flap Token Launcher",
    title: "Flap Token Launcher | Deploy Tokens on Flap Protocol",
    description:
      "Launch your own token on Flap Protocol. Easy token deployment on BSC, Base, Monad with bonding curve, auto DEX migration & tax support.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Flap Token Launcher - Deploy Tokens on Flap Protocol",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Flap Token Launcher | Deploy Tokens on Flap Protocol",
    description:
      "Launch your own token on Flap Protocol. Easy deployment on BSC, Base, Monad with bonding curve & auto DEX migration.",
    images: ["/og-image.png"],
    creator: "@FlapProtocol",
  },
  alternates: {
    canonical: "https://flap-token-launcher.vercel.app",
  },
  category: "Cryptocurrency",
  classification: "Token Launcher, DeFi, Cryptocurrency",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4F46E5" />
        <meta name="google-site-verification" content="your-verification-code" />
        
        {/* Structured Data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Flap Token Launcher",
              description:
                "Launch your own token on Flap Protocol with bonding curve, auto DEX migration, and tax support.",
              url: "https://flap-token-launcher.vercel.app",
              applicationCategory: "FinanceApplication",
              operatingSystem: "Web Browser",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.8",
                ratingCount: "150",
              },
            }),
          }}
        />
        
        {/* FAQ Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "What is Flap Token Launcher?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Flap Token Launcher is a web application that allows you to deploy tokens on Flap Protocol across multiple blockchains including BSC, Base, Ethereum, and Monad. It features bonding curve pricing, automatic DEX migration, and optional tax support.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Which blockchains does Flap Token Launcher support?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Flap Token Launcher supports BSC (BNB Smart Chain), Base, Ethereum, Arbitrum, X Layer, Morph, and Monad blockchains.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Do I need coding skills to launch a token?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "No! Flap Token Launcher is designed for everyone. Simply fill in your token details, connect your wallet, and deploy with one click.",
                  },
                },
                {
                  "@type": "Question",
                  name: "What is a bonding curve?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "A bonding curve is a mathematical formula that determines token price based on supply. As more tokens are bought, the price increases automatically. When the threshold is reached, liquidity migrates to a DEX like PancakeSwap.",
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
