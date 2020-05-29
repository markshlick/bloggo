import { Heading, Grid, Box, Badge } from 'theme-ui';
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
      <Box my={3}>
        <Heading as="h2">/blog</Heading>
      </Box>
      <Grid gap={3} columns={[null, 2, 3]}>
        {posts.map(({ title, slug, tags }) => (
          <Box key={slug}>
            <Box>
              <Link variant="nav" to={Pages.blogPost({ slug })}>
                {title}
              </Link>
            </Box>
            {/* {tags?.map((tag) => (
              <>
                <Badge mr={1} key={tag}>
                  {tag}
                </Badge>
              </>
            ))} */}
          </Box>
        ))}
      </Grid>
    </>
  );
}
