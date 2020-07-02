// @ts-check

const withMdx = require('@next/mdx');
const rehypePrism = require('@mapbox/rehype-prism');

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
          return {
            ...baseEntries,
            [rssFeedFilePath]: rssFeedFilePath,
          };
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
    rehypePlugins: [rehypePrism],
  },
};

function config() {
  return {
    target: 'serverless',
    pageExtensions: pageExts,
  };
}

module.exports = withMdx(withMdxOpts)(withRss(config()));
