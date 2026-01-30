import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Set your desired limit here
    },
  },
  /* config options here */
};

export default nextConfig;
