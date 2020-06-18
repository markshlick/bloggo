import URL, { UrlObject } from 'url';

// names

export const title = 'mark shlick';

export const moji = '🌲';

export const what = 'quarantine-ing';

export const where = 'Hillsboro, Oregon';

// files

export const hostname = 'mksh.io';

export const rssFileName = 'rss.xml';

export const rssFeedPath = `/_next/static/${rssFileName}`;

export const signalingServerProd = 'https://chill.onrender.com';

export const signalingServerDev = 'http://localhost:3001';

export const signalingServerUrl =
  process.env.NODE_ENV === 'production' ? signalingServerProd : signalingServerDev;

// keys

export const giphyApiKey = 'EilKHJDlSoAHjFVugtLEDK6gqy2aR4V8';

export const fathomSiteId = 'PXLGGGJK';

export const stripeSubscriptionPriceId = 'price_1GrXmtIZl1DrUnWJCIGqnUzW';

// helpers

export function url(pathname?: UrlObject['pathname'], query?: UrlObject['query']) {
  return URL.format({ protocol: 'https', hostname, pathname, query });
}
