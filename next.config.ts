import type { NextConfig } from "next";

/**
 * Photos live in private Supabase Storage buckets and reach the browser as
 * signed URLs on the project's own host. next/image refuses any remote host it
 * was not told about, so without this every building photograph throws at
 * render time and the section around it goes blank.
 */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/sign/**",
          },
        ]
      : [],
  },

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
