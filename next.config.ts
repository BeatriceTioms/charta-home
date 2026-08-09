import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/how-it-works",
        destination: "/features#journey",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
