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

export default function Home({ posts }: HomeProps) {
  return (
    <>
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
