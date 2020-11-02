import { GetStaticProps } from 'next';
import Link from 'components/Link';
import { Section, Space } from 'components/ui';
import Pages from 'config/Pages';
import { getPostsIndex, Post } from 'helpers/blogPosts';

type HomeProps = {
  posts: Post[];
  // notes: Post[];
};

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  const posts = await getPostsIndex('blog');
  // const notes = await getPostsIndex('notes');

  return {
    props: { posts },
  };
};

const projects: {
  name: string;
  url: string;
  description: string;
}[] = [
  {
    name: 'HyperRequire',
    url: 'https://www.npmjs.com/package/hyper-require',
    description: `HyperRequire is a tool to speed up your development workflow. It's like a souped-up React Hot Loader for the backend. 🔥 Just save a file and HyperRequire will auto-magically ✨ patch the new code into your running program.`,
  },
  {
    name: 'javacrisps.com',
    url: 'https://javacrisps.com',
    description:
      "Notes on the internet's favorite language.",
  },
];

export default function Home({ posts }: HomeProps) {
  return (
    <>
      <Section>
        <h2>/projects/</h2>
        {projects.map(({ name, url, description }) => (
          <div>
            <strong>
              <a href={url} target="_blank" rel="noopener">
                {name}
              </a>
            </strong>
            <p>{description}</p>
          </div>
        ))}
      </Section>
      <Section>
        <h2>/blog/</h2>
        <div>
          {posts.map(({ title, slug, tags }) => (
            <Space key={slug} s>
              <strong>
                <Link to={Pages.blogPost({ slug })}>
                  {title}
                </Link>
              </strong>
            </Space>
          ))}
        </div>
      </Section>
      {/* 
      <Section>
        <h2>/notes/</h2>
        <div>
          {notes.map(({ title, slug, tags }) => (
            <Space key={slug} s>
              <strong>
                <Link to={Pages.note({ slug })}>
                  {title}
                </Link>
              </strong>
            </Space>
          ))}
        </div>
      </Section> */}
    </>
  );
}
