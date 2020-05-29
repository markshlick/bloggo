import URL, { UrlObject } from 'url';

export const hostname = 'mrk.cool';

export const title = 'mark shlick';

export const rssFeedPath = '/_next/static/rss.xml';

export const fathomSiteId = 'PXLGGGJK';

export function url(pathname?: UrlObject['pathname'], query?: UrlObject['query']) {
  return URL.format({ protocol: 'https', hostname, pathname, query });
}
