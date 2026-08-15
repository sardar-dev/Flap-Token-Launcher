import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    unoptimized: true, // For external URLs that may not support image optimization
  },
  // Skip type checking during build to avoid build-time database connection issues
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
