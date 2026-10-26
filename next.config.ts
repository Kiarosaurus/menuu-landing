import type { NextConfig } from "next";

const DEV_LOCAL_IP = "192.168.18.6";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost:3000",
    "localhost:3001",
    "127.0.0.1:3000",
    `${DEV_LOCAL_IP}:3000`,
    `${DEV_LOCAL_IP}`,
  ],
};

export default nextConfig;
