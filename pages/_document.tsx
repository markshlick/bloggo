import Document, { Html, Head, Main, NextScript, DocumentContext } from 'next/document';
import { title, rssFeedPath } from 'config/site';

class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    return (
      <Html>
        <Head>
          <link rel="icon" href="/favicon.ico" />
          <link rel="alternate" type="application/rss+xml" href={rssFeedPath} />
          <link
            href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;700&display=swap"
            rel="stylesheet"
          ></link>
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
