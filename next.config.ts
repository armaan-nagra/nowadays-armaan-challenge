import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // hide the dev-tools indicator bubble (dev-only overlay; never ships to prod)
  devIndicators: false,
};

export default nextConfig;
