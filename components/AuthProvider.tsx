import React, {
  useState,
  useEffect,
  useContext,
} from 'react';
import createAuth0Client, {
  Auth0ClientOptions,
  Auth0Client,
} from '@auth0/auth0-spa-js';

const auth0InitOptions = {
  client_id: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!,
  domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN!,
  redirect_uri: 'http://localhost:3000/',
};

const defaultRedirectCallback = () =>
  window.history.replaceState(
    {},
    document.title,
    window.location.pathname,
  );

export const Auth0Context = React.createContext<{
  isAuthenticated: boolean;
  user: any | null;
  loading: boolean;
  popupOpen: boolean;
  login: () => void;
  logout: () => void;
}>({
  isAuthenticated: false,
  user: null,
  loading: false,
  popupOpen: false,
  login: () => {},
  logout: () => {},
});

export const useAuth0 = () => useContext(Auth0Context);

export const Auth0Provider = ({
  children,
  onRedirectCallback = defaultRedirectCallback,
  initOptions,
}: React.PropsWithChildren<{
  onRedirectCallback?: (state: any) => void;
  initOptions: Auth0ClientOptions;
}>) => {
  const [isAuthenticated, setIsAuthenticated] = useState<
    boolean
  >(false);
  const [user, setUser] = useState();
  const [auth0Client, setAuth0] = useState<Auth0Client>();
  const [loading, setLoading] = useState(true);
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    const initAuth0 = async () => {
      const auth0FromHook = await createAuth0Client(
        initOptions,
      );
      setAuth0(auth0FromHook);

      if (
        window.location.search.includes('code=') &&
        window.location.search.includes('state=')
      ) {
        const redirectLoginResult = await auth0FromHook.handleRedirectCallback();
        onRedirectCallback(redirectLoginResult.appState);
      }

      const isAuthenticated = await auth0FromHook.isAuthenticated();

      setIsAuthenticated(isAuthenticated);

      if (isAuthenticated) {
        const user = await auth0FromHook.getUser();
        setUser(user);
      }

      setLoading(false);
    };
    initAuth0();
    // eslint-disable-next-line
  }, []);

  const login = async (params = {}) => {
    if (!auth0Client) {
      throw new Error();
    }

    setPopupOpen(true);
    try {
      await auth0Client.loginWithPopup(params);
    } catch (error) {
      console.error(error);
    } finally {
      setPopupOpen(false);
    }
    const user = await auth0Client.getUser();
    setUser(user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    if (!auth0Client) {
      throw new Error();
    }

    auth0Client.logout();
  };

  return (
    <Auth0Context.Provider
      value={{
        isAuthenticated,
        user,
        loading,
        popupOpen,
        login,
        logout,
      }}
    >
      {children}
    </Auth0Context.Provider>
  );
};
