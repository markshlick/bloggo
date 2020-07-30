import './app.css';
import './theme.css';
import './code.css';
import { useEffect, useState } from 'react';
import {
  PageContainer,
  Section,
  Box,
  Right,
  Space,
  SpaceInline,
  ButtonUnstyled,
} from 'components/ui';
import { AppProps } from 'next/app';
import Pages from 'config/Pages';
import Link from 'components/Link';

import { title, fathomSiteId, moji } from 'config/site';
import Head from 'next/head';
import {
  Auth0Provider,
  useAuth0,
} from 'components/AuthProvider';

const auth0InitOptions = {
  client_id: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!,
  domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN!,
  redirect_uri: 'http://localhost:3000/',
};

const AppContextProviders = ({
  children,
}: React.PropsWithChildren<{}>) => (
  <Auth0Provider initOptions={auth0InitOptions}>
    {children}
  </Auth0Provider>
);

const useAnalytics = () => {
  useEffect(() => {
    let tracker = window.document.createElement('script');
    let firstScript = window.document.getElementsByTagName(
      'script',
    )[0];
    tracker.defer = true;
    tracker.setAttribute('site', fathomSiteId);
    tracker.setAttribute('spa', 'auto');
    tracker.src = 'https://cdn.usefathom.com/script.js';
    firstScript.parentNode?.insertBefore(
      tracker,
      firstScript,
    );
  }, []);
};

export default function App(props: AppProps) {
  const { Component, pageProps } = props;
  // @ts-ignore
  const noHeader = Component.layout === 'none';

  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  useAnalytics();

  return (
    <AppContextProviders>
      {noHeader ? (
        <Component {...pageProps} />
      ) : (
        <>
          <Head>
            <title>{title}</title>
          </Head>
          <PageContainer>
            <Header
              darkMode={darkMode}
              onClickDarkModeToggle={setDarkMode}
            />
            <Component {...pageProps} />
          </PageContainer>
        </>
      )}
    </AppContextProviders>
  );
}

function Header({
  darkMode,
  onClickDarkModeToggle,
}: {
  darkMode: boolean;
  onClickDarkModeToggle: (d: boolean) => void;
}) {
  // const { login, logout, isAuthenticated, user } = useAuth0();

  return (
    <Section>
      <Box>
        <h1>
          <Link to={Pages.home()}>
            {moji} {title}
          </Link>
        </h1>
        <Right>
          <Space>
            <SpaceInline>
              <Link to={Pages.about()}>about</Link>
            </SpaceInline>
            <ButtonUnstyled
              onClick={() =>
                onClickDarkModeToggle(!darkMode)
              }
            >
              {darkMode ? '☀️' : '🌑'}
            </ButtonUnstyled>
          </Space>
        </Right>
        {/* {isAuthenticated ? (
            <ThemeUILink onClick={() => logout()} variant="nav">
              log out
            </ThemeUILink>
          ) : (
            <>
              <Link to={Pages.subscribe()}>
                subscribe
              </Link>
              <ThemeUILink onClick={() => login()} variant="nav">
                log in
              </ThemeUILink>
            </>
          )} */}
      </Box>
    </Section>
  );
}
