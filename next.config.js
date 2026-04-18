/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { domains: ['nauss.edu.sa'] },
  experimental: {
    outputFileTracingIncludes: {
      '/*': ['./templates/**/*'],
    },
  },
}
module.exports = nextConfig
