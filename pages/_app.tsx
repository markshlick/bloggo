import { useEffect } from 'react';
import { ThemeProvider, Container, Flex, Box } from 'theme-ui';
import { AppProps } from 'next/app';
import theme from 'config/theme';
import Pages from 'config/Pages';
import Link from 'components/Link';
import { title, fathomSiteId, moji } from 'config/site';
import Head from 'next/head';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    let tracker = window.document.createElement('script');
    let firstScript = window.document.getElementsByTagName('script')[0];
    tracker.defer = true;
    tracker.setAttribute('site', fathomSiteId);
    tracker.setAttribute('spa', 'auto');
    tracker.src = 'https://cdn.usefathom.com/script.js';
    firstScript.parentNode?.insertBefore(tracker, firstScript);
  }, []);

  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <ThemeProvider theme={theme}>
        <Container px={[3, null, 0]}>
          <Flex my="2" sx={{ alignItems: 'baseline' }}>
            <Box sx={{ flex: '1 1 auto' }}>
              <Link variant="big" to={Pages.home()}>
                {moji} {title}
              </Link>
            </Box>
            <Box>
              <Link variant="nav" to={Pages.about()}>
                about me
              </Link>
            </Box>
          </Flex>
          <Component {...pageProps} />
        </Container>
      </ThemeProvider>
    </>
  );
}
