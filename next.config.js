// @ts-check

const rehypeWavesPlugin = require('rehype-waves');
const withMdx = require('@next/mdx');

const rssFeedFilePath = './scripts/rss.ts';
const rssFeedOutputFilePath = 'rss.xml';

function withRss(nextConf) {
  return {
    ...nextConf,
    experimental: {
      rewrites() {
        return [
          {
            source: `/${rssFeedOutputFilePath}`,
            destination: `/_next/static/${rssFeedOutputFilePath}`,
          },
        ];
      },
    },
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
    pageExtensions: pageExts,
  };
}

module.exports = withMdx(withMdxOpts)(withRss(config()));
