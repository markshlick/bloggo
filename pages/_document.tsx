import Document, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentContext,
} from 'next/document';
import { rssFeedPath, moji } from 'config/site';
import { DarkMode } from 'helpers/darkModeKit';

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(
      ctx,
    );
    return { ...initialProps };
  }

  render() {
    return (
      <Html>
        <Head>
          <link
            rel="icon"
            href={`data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${moji}</text></svg>`}
          />
          <link
            rel="alternate"
            type="application/rss+xml"
            href={rssFeedPath}
          />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;900&display=swap"
          />
          <meta
            name="apple-mobile-web-app-capable"
            content="yes"
          />
          <meta
            name="apple-mobile-web-app-status-bar-style"
            content="black-translucent"
          />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no"
          />
          <meta name="HandheldFriendly" content="true" />
          <meta charSet="UTF-8" />
          <script
            async
            defer
            data-domain="mksh.io"
            src="https://plausible.io/js/plausible.js"
          ></script>
        </Head>
        <body>
          <DarkMode />
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
