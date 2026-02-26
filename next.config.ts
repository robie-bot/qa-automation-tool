import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['playwright', 'pdfkit', 'sharp'],
};

export default nextConfig;
