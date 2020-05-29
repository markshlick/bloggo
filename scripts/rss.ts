import fs from 'fs';
import path from 'path';
import RSS from 'rss';
import { getPostsIndex } from 'helpers/blogPosts';
import { title, url, rssFeedPath, rssFileName } from 'config/site';

const outputPath = './.next/static/';

export default async function generate() {
  const blogPosts = await getPostsIndex();

  const feed = new RSS({
    title: title,
    site_url: url(),
    feed_url: url(rssFeedPath),
  });

  blogPosts.forEach((blogPost) => {
    feed.item({
      title: blogPost.title,
      guid: blogPost.slug,
      url: url(blogPost.path),
      date: blogPost.date,
      categories: blogPost.categories ?? [],
      description: blogPost.description ?? '',
    });
  });

  const rss = feed.xml({ indent: true });
  await fs.promises.writeFile(path.join(outputPath, rssFileName), rss);
}
