import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
};

export default nextConfig;
