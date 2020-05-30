import { Heading, Grid, Box, Text } from 'theme-ui';
import { where, what } from 'config/site';

export default function About() {
  return (
    <>
      <Box my={3}>
        <Heading as="h2">/about</Heading>
      </Box>
      <Grid gap={3} columns={[null, 1]}>
        <Box>
          <Text>
            Hi, I'm <strong>Mark</strong>. 👋🏼 I'm a traveling nerd currently <strong>{what}</strong>{' '}
            in <strong>{where}</strong>.
          </Text>
          <Text>This blog is just getting started, but please check back soon!</Text>
        </Box>
      </Grid>
    </>
  );
}
