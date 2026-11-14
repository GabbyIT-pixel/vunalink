import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating "N" dev badge so it doesn't cover the bottom menu in screenshots.
  // Build and runtime errors will still pop up.
  devIndicators: false,
};

export default nextConfig;
