import URL, { UrlObject } from 'url';

// names

export const title = 'mksh.io';

export const moji = '🌲';

export const what = 'quarantine-ing';

export const where = 'Hillsboro, Oregon';

// files

export const hostname = 'mksh.io';

export const rssFileName = 'rss.xml';

export const rssFeedPath = `/_next/static/${rssFileName}`;

// keys

export const fathomSiteId = 'PXLGGGJK';

export const stripeSubscriptionPriceId =
  'price_1GrXmtIZl1DrUnWJCIGqnUzW';

export const iceServers = [
  {
    urls: 'stun:stun.l.google.com:19302',
  },
];

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
