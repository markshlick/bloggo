import URL, { UrlObject } from 'url';

// names

export const title = 'mksh.io';

export const moji = '🌲';

export const what = 'working on tools for better coding';

export const where = 'Orenco, Oregon';

// files

export const hostname = 'mksh.io';

export const rssFileName = 'rss.xml';

export const rssFeedPath = `/_next/static/${rssFileName}`;

// keys

export const stripeSubscriptionPriceId =
  'price_1GrXmtIZl1DrUnWJCIGqnUzW';

// helpers

export function url(
  pathname?: UrlObject['pathname'],
  query?: UrlObject['query'],
) {
  return URL.format({
    protocol: 'https',
    hostname,
    pathname,
    query,
  });
}
