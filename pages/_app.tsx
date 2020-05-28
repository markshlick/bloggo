import React from 'react';
import { ThemeProvider, Container, Flex, Box } from 'theme-ui';
import NextApp from 'next/app';
import theme from 'config/theme';
import Pages from 'config/Pages';
import Link from 'components/Link';
import { title } from 'config/site';
import Head from 'next/head';

export default class App extends NextApp {
  render() {
    const { Component, pageProps } = this.props;
    return (
      <>
        <Head>
          <title>{title}</title>
        </Head>
        <ThemeProvider theme={theme}>
          <Container py="3" px={[3, null, 0]}>
            <Flex sx={{ alignItems: 'baseline' }}>
              <Box sx={{ flex: '1 1 auto' }}>
                <Link variant="big" to={Pages.home()}>
                  {title}
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
}
