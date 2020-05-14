import URL, { UrlObject } from 'url';

export const hostname = 'mrk.cool';

export const title = 'mark:website';

export const rssFeedPath = '/rss.xml';

export function url(pathname?: UrlObject['pathname'], query?: UrlObject['query']) {
  return URL.format({ protocol: 'https', hostname, pathname, query });
}
