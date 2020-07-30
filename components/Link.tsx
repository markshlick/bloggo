import NextLink from 'next/link';
import { PropsWithChildren, CSSProperties } from 'react';
import { Styles } from './ui';

export default function Link({
  to: { href, as },
  children,
  className,
  style,
}: PropsWithChildren<
  Styles & {
    to: {
      href: string;
      as: string;
    };
  }
>) {
  return (
    <NextLink passHref href={href} as={as}>
      <a className={className} style={style}>
        {children}
      </a>
    </NextLink>
  );
}
