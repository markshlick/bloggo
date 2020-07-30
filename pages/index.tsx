import { GetStaticProps } from 'next';
import Link from 'components/Link';
import { Section } from 'components/ui';
import Pages from 'config/Pages';
import { getPostsIndex, Post } from 'helpers/blogPosts';

export const getStaticProps: GetStaticProps = async () => {
  const posts = await getPostsIndex('blog');
  const notes = await getPostsIndex('notes');

  return {
    props: { posts, notes },
  };
};

export default function Home({
  posts,
  notes,
}: {
  posts: Post[];
  notes: Post[];
}) {
  return (
    <>
      <Section>
        <h2>/blog/</h2>
        <div>
          {posts.map(({ title, slug, tags }) => (
            <div key={slug}>
              <strong>
                <Link to={Pages.blogPost({ slug })}>
                  {title}
                </Link>
              </strong>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <h2>/notes/</h2>
        <div>
          {notes.map(({ title, slug, tags }) => (
            <div key={slug}>
              <strong>
                <Link to={Pages.note({ slug })}>
                  {title}
                </Link>
              </strong>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
