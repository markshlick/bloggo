import { Heading, Grid, Box } from 'theme-ui';

export default function About() {
  return (
    <>
      <Box my={3}>
        <Heading as="h2">/about</Heading>
      </Box>
      <Grid gap={3} columns={[null, 2]}>
        <Box>
          Lorem ipsum dolor sit, amet consectetur adipisicing elit. Eveniet, veritatis architecto?
          Harum, enim. Fuga consequuntur tempore adipisci atque maxime illo, dolorum voluptatibus
          sint impedit temporibus beatae exercitationem libero blanditiis dolorem!
        </Box>
        <Box>
          Lorem ipsum dolor sit, amet consectetur adipisicing elit. Eveniet, veritatis architecto?
          Harum, enim. Fuga consequuntur tempore adipisci atque maxime illo, dolorum voluptatibus
          sint impedit temporibus beatae exercitationem libero blanditiis dolorem!
        </Box>
        <Box>
          Lorem ipsum dolor sit, amet consectetur adipisicing elit. Eveniet, veritatis architecto?
          Harum, enim. Fuga consequuntur tempore adipisci atque maxime illo, dolorum voluptatibus
          sint impedit temporibus beatae exercitationem libero blanditiis dolorem!
        </Box>
      </Grid>
    </>
  );
}
