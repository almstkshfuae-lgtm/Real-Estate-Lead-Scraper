import { fileURLToPath } from 'url';
import { dirname } from 'path';
import withPWAInit from "@ducanh2912/next-pwa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lucide-react'],
  turbopack: {
    root: __dirname,
  },
};

export default withPWA(nextConfig);
