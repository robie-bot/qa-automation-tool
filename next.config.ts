import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['playwright', 'playwright-core', '@sparticuz/chromium', 'pdfkit', 'sharp'],
};

export default nextConfig;
