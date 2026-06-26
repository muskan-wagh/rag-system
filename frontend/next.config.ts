import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://rag-system-backend.up.railway.app/"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}api/:path*`,
      },
    ];
  },
};

export default nextConfig;
