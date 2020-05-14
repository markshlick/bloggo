import NextLink from 'next/link';
import { Link as ThemeUILink } from 'theme-ui';
import { PropsWithChildren } from 'react';

export default function Link({
  to: { href, as },
  variant,
  children,
  ...props
}: PropsWithChildren<{
  variant?: string;
  to: {
    href: string;
    as: string;
  };
}>) {
  const themeLinkProps: { variant?: string } = {};
  if (variant) {
    themeLinkProps.variant = variant;
  }

  return (
    <NextLink passHref href={href} as={as} {...props}>
      <ThemeUILink {...themeLinkProps}>{children}</ThemeUILink>
    </NextLink>
  );
}
