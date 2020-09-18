// @ts-check

const withMdx = require('@next/mdx');
const withCSS = require('@zeit/next-css');
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

const pageExts = [
  'js',
  'jsx',
  'ts',
  'tsx',
  'md',
  'mdx',
  'css',
];

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
    typescript: {
      // !! WARN !!
      // Dangerously allow production builds to successfully complete even if
      // your project has type errors.
      // !! WARN !!
      ignoreBuildErrors: true,
    },
  };
}

module.exports = withCSS(
  withMdx(withMdxOpts)(withRss(config())),
);
