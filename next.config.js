// @ts-check
require('dotenv').config();

const rehypeWavesPlugin = require('rehype-waves');
const withMdx = require('@next/mdx');

const rssFeedFilePath = './scripts/rss.ts';

function withRss(nextConf) {
  return {
    ...nextConf,
    webpack: (config, { dev, isServer }) => {
      if (isServer && !dev) {
        const originalEntry = config.entry;

        config.entry = async () => {
          const baseEntries = await originalEntry();
          // This script imports components from the Next app, so it's transpiled
          return { ...baseEntries, [rssFeedFilePath]: rssFeedFilePath };
        };
      }

      return config;
    },
  };
}

const pageExts = ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'];

const withMdxOpts = {
  extension: /\.(md|mdx)$/,
  options: {
    rehypePlugins: [rehypeWavesPlugin],
  },
};

function config() {
  return {
    target: 'serverless',
    pageExtensions: pageExts,
    env: {
      STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    },
  };
}

module.exports = withMdx(withMdxOpts)(withRss(config()));
