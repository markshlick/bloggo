import NextLink from 'next/link';
import { Link as ThemeUILink, LinkProps } from 'theme-ui';
import { PropsWithChildren } from 'react';

export default function Link({
  to: { href, as },
  variant,
  children,
  ...props
}: PropsWithChildren<
  LinkProps & {
    variant?: string;
    to: {
      href: string;
      as: string;
    };
  }
>) {
  const themeLinkProps: LinkProps & { variant?: string } = { ...props };
  if (variant) {
    themeLinkProps.variant = variant;
  }

  return (
    <NextLink passHref href={href} as={as}>
      <ThemeUILink {...themeLinkProps}>{children}</ThemeUILink>
    </NextLink>
  );
}
