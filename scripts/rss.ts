import fs from 'fs';
import path from 'path';
import RSS from 'rss';
import { getPostsIndex } from 'helpers/blogPosts';
import { title, url, rssFeedPath } from 'config/site';

const defaultOutputPath = './.next/static/';

export default async function generate(outputPath = defaultOutputPath) {
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

  if (!fs.existsSync(defaultOutputPath)) {
    await fs.promises.mkdir(defaultOutputPath, { recursive: true });
  }

  const rss = feed.xml({ indent: true });
  fs.writeFileSync(path.join(outputPath, rssFeedPath), rss);
}
