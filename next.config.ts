import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/how-it-works",
        destination: "/features#journey",
        permanent: true,
      },
      {
        source: "/faq",
        destination: "/pricing#faq",
        permanent: true,
      },
      {
        source: "/dashboard/buildings",
        destination: "/dashboard/apartments",
        permanent: false,
      },
      {
        source: "/dashboard/buildings/:path*",
        destination: "/dashboard/apartments",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
