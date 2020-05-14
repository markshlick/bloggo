import { Heading, Grid, Box } from 'theme-ui';
import { GetStaticProps } from 'next';
import Link from 'components/Link';
import Pages from 'config/Pages';
import { getPostsIndex, BlogPost } from 'helpers/blogPosts';

export const getStaticProps: GetStaticProps = async () => {
  const posts = await getPostsIndex();

  return {
    props: { posts },
  };
};

export default function Home({ posts }: { posts: BlogPost[] }) {
  return (
    <>
      <Box py={4}>
        <Heading as="h2">/blog</Heading>
      </Box>
      <Grid gap={3} columns={[null, 2, 4]}>
        {posts.map(({ title, slug }) => (
          <Box key={slug}>
            <Link to={Pages.blogPost({ slug })}>{title}</Link>
          </Box>
        ))}
      </Grid>
    </>
  );
}
