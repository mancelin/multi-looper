import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: Capacitor wraps the `out/` directory into the native app.
  // The app is fully client-side, so nothing is lost by exporting.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
