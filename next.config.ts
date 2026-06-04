import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['192.168.31.199'],
  
  // Docker 部署优化
  output: 'standalone',
};

export default nextConfig;
