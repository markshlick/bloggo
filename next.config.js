const rehypeWavesPlugin = require('rehype-waves');
const withMdx = require('@next/mdx');

const rssFeedFilePath = 'scripts/rss.ts';
const rssFeedOutputFilePath = 'rss.xml';

const nextRssWebpackPlugin = () => ({
  apply: (compiler) => {
    compiler.hooks.afterEmit.tapPromise('AfterEmitPlugin', () => {
      let generateRss;
      try {
        generateRss = require(`./.next/server/${rssFeedFilePath}`).default;
      } catch (error) {
        // vercel uses the serverless dir
        generateRss = require(`./.next/serverless/${rssFeedFilePath}`).default;
      }

      return generateRss();
    });
  },
});

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

        if (!dev && isServer) {
          config.plugins.push(nextRssWebpackPlugin());
        }

        config.entry = async () => {
          const entries = { ...(await originalEntry()) };
          // This script imports components from the Next app, so it's transpiled
          entries[`./${rssFeedFilePath}`] = `./${rssFeedFilePath}`;
          return entries;
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
