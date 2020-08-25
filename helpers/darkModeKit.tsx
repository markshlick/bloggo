import { useState, useEffect } from 'react';

export function getInitialColorMode() {
  const persistedColorPreference = window.localStorage.getItem(
    'colorMode',
  );

  if (persistedColorPreference) {
    return persistedColorPreference;
  }

  const mq = window.matchMedia(
    '(prefers-color-scheme: dark)',
  ).matches;

  return mq ? 'dark' : 'light';
}

const prefersDarkMode_cached =
  typeof window !== 'undefined'
    ? getInitialColorMode() === 'dark'
    : false;

export const useDarkMode = () => {
  const [darkMode, setDarkMode] = useState(
    prefersDarkMode_cached,
  );

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

export function setInitialColorMode_toString() {
  const mq = window.matchMedia(
    '(prefers-color-scheme: dark)',
  ).matches;

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

const __dangerousIife = (fn: Function) =>
  `(${fn.toString()})()`;

export const DarkMode = () => {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: __dangerousIife(
          setInitialColorMode_toString,
        ),
      }}
    ></script>
  );
};
