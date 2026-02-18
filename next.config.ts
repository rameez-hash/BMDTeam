import type { NextConfig } from "next";

// Set Pakistan timezone for ALL server-side Date operations
process.env.TZ = 'Asia/Karachi';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'bmdhouse.com',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
    unoptimized: true,
  },
};

export default nextConfig;
