const rssFeedFilePath = 'scripts/rss.ts';

function go() {
  let generateRss;
  try {
    generateRss = require(`./.next/server/${rssFeedFilePath}`).default;
  } catch (error) {
    // vercel uses the serverless dir
    generateRss = require(`./.next/serverless/${rssFeedFilePath}`).default;
  }

  return generateRss();
}

go();
