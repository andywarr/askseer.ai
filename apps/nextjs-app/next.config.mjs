/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: `${process.env.AWS_BUCKET_NAME}.s3.us-east-1.amazonaws.com`,
        pathname: "**",
      },
    ],
  },
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/client-runtime-utils",
    ".prisma",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
