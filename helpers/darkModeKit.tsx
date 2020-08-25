import { useState, useEffect } from 'react';

export function getInitialColorMode() {
  const persistedColorPreference = window.localStorage.getItem(
    'colorMode',
  );

  const hasPersistedPreference =
    typeof persistedColorPreference === 'string';
  // If the user has explicitly chosen light or dark,
  // let's use it. Otherwise, this value will be null.
  // If they haven't been explicit, let's check the media
  // query

  if (hasPersistedPreference) {
    return persistedColorPreference;
  }

  const mql = window.matchMedia(
    '(prefers-color-scheme: dark)',
  );

  return mql.matches === true ? 'dark' : 'light';
}

const prefersDarkMode =
  typeof window !== 'undefined'
    ? getInitialColorMode() === 'dark'
    : false;

export const useDarkMode = () => {
  const [darkMode, setDarkMode] = useState(prefersDarkMode);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
      window.localStorage.setItem('colorMode', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      window.localStorage.setItem('colorMode', 'light');
    }
  }, [darkMode]);

  return { darkMode, setDarkMode };
};

export function setInitialColorMode() {
  const mq =
    window.matchMedia('(prefers-color-scheme: dark)')
      .matches === true;

  let prefersDark = mq;

  const persistedColorPreference = window.localStorage.getItem(
    'colorMode',
  );

  if (persistedColorPreference) {
    prefersDark = persistedColorPreference === 'dark';
  }

  if (prefersDark) {
    document.body.classList.add('dark-mode');
  }
}

export const DarkMode = () => {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(${setInitialColorMode.toString()})()`,
      }}
    ></script>
  );
};
