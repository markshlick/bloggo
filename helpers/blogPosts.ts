import path from 'path';
import { promises as fs } from 'fs';

interface BlogPostBase {
  title: string;
  date: string;
  description?: string;
  pub?: boolean;
  tags?: string[];
  categories?: string[];
  image?: string;
}

export interface Post extends BlogPostBase {
  slug: string;
  path: string;
}

const sortBlogPostsByDate = (
  post1: Post,
  post2: Post,
): 1 | -1 =>
  new Date(post1.date) > new Date(post2.date) ? -1 : 1;

export async function getPostsIndex(
  rootPath: string,
): Promise<Post[]> {
  const postFileNames = await fs.readdir(
    `./pages/${rootPath}`,
  );

  const posts: Post[] = postFileNames.map((name) => {
    const blogPost: {
      meta: BlogPostBase;
    } = require(`../pages/${rootPath}/${name}`);
    const slug = path.parse(name).name;
    return {
      ...blogPost.meta,
      path: `/blog/${slug}`,
      slug,
    };
  });

  return posts
    .filter(({ pub }) => {
      if (process.env.NODE_ENV === 'development')
        return true;
      return pub;
    })
    .sort(sortBlogPostsByDate);
}

export async function getPostsByCategoriesAndTags(): Promise<{
  tags: Map<string, Post[]>;
  categories: Map<string, Post[]>;
}> {
  const blogPosts = await getPostsIndex('blog');

  const tags = new Map();
  const categories = new Map();

  for (const post of blogPosts) {
    for (const tag of post.tags ?? []) {
      if (!tags.has(tag)) {
        tags.set(tag, []);
      }
      tags.get(tag).push(post);
    }
    for (const category of post.categories ?? []) {
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category).push(post);
    }
  }

  return {
    tags,
    categories,
  };
}
