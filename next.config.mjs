/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: `${process.env.AWS_BUCKET_NAME}.s3.us-east-1.amazonaws.com`,
        pathname: "**",
      },
    ],
  },
};

export default nextConfig;
