/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [`${process.env.AWS_BUCKET_NAME}.s3.us-east-1.amazonaws.com`],
  },
};

export default nextConfig;
