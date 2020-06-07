import { useEffect } from 'react';
import { ThemeProvider, Container, Flex, Box } from 'theme-ui';
import { AppProps } from 'next/app';
import theme from 'config/theme';
import Pages from 'config/Pages';
import Link from 'components/Link';
import { Link as ThemeUILink } from 'theme-ui';

import { title, fathomSiteId, moji } from 'config/site';
import Head from 'next/head';
import { Auth0Provider, useAuth0 } from 'components/AuthProvider';

const auth0InitOptions = {
  client_id: process.env.AUTH0_CLIENT_ID!,
  domain: process.env.AUTH0_DOMAIN!,
  redirect_uri: 'http://localhost:3000/',
};

const AppContextProviders = ({ children }: React.PropsWithChildren<{}>) => (
  <ThemeProvider theme={theme}>
    <Auth0Provider initOptions={auth0InitOptions}>{children}</Auth0Provider>
  </ThemeProvider>
);

const useAnalytics = () => {
  useEffect(() => {
    let tracker = window.document.createElement('script');
    let firstScript = window.document.getElementsByTagName('script')[0];
    tracker.defer = true;
    tracker.setAttribute('site', fathomSiteId);
    tracker.setAttribute('spa', 'auto');
    tracker.src = 'https://cdn.usefathom.com/script.js';
    firstScript.parentNode?.insertBefore(tracker, firstScript);
  }, []);
};

export default function App({ Component, pageProps }: AppProps) {
  useAnalytics();

  return (
    <>
      <AppContextProviders>
        <Head>
          <title>{title}</title>
        </Head>
        <Header />
        <Container px={[3, null, 0]}>
          <Component {...pageProps} />
        </Container>
      </AppContextProviders>
    </>
  );
}

function Header() {
  const { login, logout, isAuthenticated, user } = useAuth0();
  console.log(user);

  return (
    <Container px={[3, null, 0]}>
      <Flex my="2" sx={{ alignItems: 'center' }}>
        <Box sx={{ flex: '1 1 auto' }}>
          <Link variant="big" to={Pages.home()}>
            {moji} {title}
          </Link>
        </Box>
        <Box>
          <Link variant="nav" to={Pages.about()}>
            about me
          </Link>{' '}
          {isAuthenticated ? (
            <ThemeUILink onClick={() => logout()} variant="nav">
              log out
            </ThemeUILink>
          ) : (
            <ThemeUILink onClick={() => login()} variant="nav">
              log in
            </ThemeUILink>
          )}
        </Box>
      </Flex>
    </Container>
  );
}
