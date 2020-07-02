import { Heading, Grid, Box, Badge } from 'theme-ui';
import { GetStaticProps } from 'next';
import Link from 'components/Link';
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
      <Box my={3}>
        <Heading as="h2">/blog/</Heading>
      </Box>
      <Grid gap={3} columns={[null, 2, 3]}>
        {posts.map(({ title, slug, tags }) => (
          <Box key={slug}>
            <Box>
              <Link
                variant="nav"
                to={Pages.blogPost({ slug })}
              >
                {title}
              </Link>
            </Box>
          </Box>
        ))}
      </Grid>
      <Box my={3}>
        <Heading as="h2">/notes/</Heading>
      </Box>
      <Grid gap={3} columns={[null, 2, 3]}>
        {notes.map(({ title, slug, tags }) => (
          <Box key={slug}>
            <Box>
              <Link variant="nav" to={Pages.note({ slug })}>
                {title}
              </Link>
            </Box>
          </Box>
        ))}
      </Grid>
    </>
  );
}
