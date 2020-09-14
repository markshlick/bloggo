import './app.css';
import './theme.css';
import './code.css';
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

import { title, moji } from 'config/site';
import Head from 'next/head';

import { useDarkMode } from 'helpers/darkModeKit';

const Ribbon = () => (
  <>
    <Box>
      {['action', 'action-secondary', 'action-bg'].map(
        (name) => (
          <div
            key={name}
            style={{
              height: 4,
              flex: 1,
              backgroundColor: `var(--color-${name})`,
            }}
          />
        ),
      )}
    </Box>
  </>
);

export default function App(props: AppProps) {
  const { Component, pageProps } = props;
  // @ts-ignore
  const noHeader = Component.layout === null;

  const { darkMode, setDarkMode } = useDarkMode();

  return (
    <>
      {noHeader ? (
        <Component {...pageProps} />
      ) : (
        <>
          <Head>
            <title>{title}</title>
          </Head>
          <Ribbon />
          <PageContainer>
            <Header
              darkMode={darkMode}
              onClickDarkModeToggle={setDarkMode}
            />
            <Component {...pageProps} />
          </PageContainer>
        </>
      )}
    </>
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
            <>
              <ButtonUnstyled
                onClick={() =>
                  onClickDarkModeToggle(!darkMode)
                }
              >
                ☼
              </ButtonUnstyled>
            </>
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
