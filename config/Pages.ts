export default {
  blogPost: ({ slug }: { slug: string }) => ({
    href: `/blog/${slug}`,
    as: `/blog/${slug}`,
  }),
  note: ({ slug }: { slug: string }) => ({
    href: `/notes/${slug}`,
    as: `/notes/${slug}`,
  }),
  home: () => ({
    href: '/',
    as: '/',
  }),
  about: () => ({
    href: '/about',
    as: '/about',
  }),
  subscribe: () => ({
    href: '/subscribe',
    as: '/subscribe',
  }),
};
