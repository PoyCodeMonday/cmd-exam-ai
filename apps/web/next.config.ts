import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['api'],
  // Ensure the PDF-rendering fonts are bundled into the serverless function.
  // The trace root is the workspace root so the include pattern resolves cleanly.
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    '/api/**/*': ['./fonts/**/*'],
  },
  experimental: {
    // Server actions and the catch-all API route both need server-side externals.
    serverComponentsExternalPackages: [
      '@nestjs/core',
      '@nestjs/common',
      '@nestjs/platform-express',
      '@nestjs/config',
      '@nestjs/jwt',
      '@nestjs/passport',
      '@vendia/serverless-express',
      'pg',
      '@vercel/blob',
      'pdf-lib',
      '@pdf-lib/fontkit',
      'qrcode',
      'bcryptjs',
      'reflect-metadata',
      'express',
      'class-validator',
      'class-transformer',
      'passport',
      'passport-jwt',
      'multer',
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      const arr = Array.isArray(config.externals) ? config.externals : [config.externals];
      arr.push({
        '@nestjs/websockets/socket-module': 'commonjs @nestjs/websockets/socket-module',
        '@nestjs/microservices/microservices-module': 'commonjs @nestjs/microservices/microservices-module',
        '@nestjs/microservices': 'commonjs @nestjs/microservices',
        '@nestjs/websockets': 'commonjs @nestjs/websockets',
        'class-transformer/storage': 'commonjs class-transformer/storage',
        'pg-native': 'commonjs pg-native',
      });
      config.externals = arr;
    }
    return config;
  },
};

export default nextConfig;
