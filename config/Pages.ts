export default {
  blogPost: ({ slug }: { slug: string }) => ({
    href: `/blog/${slug}`,
    as: `/blog/${slug}`,
  }),
  home: () => ({
    href: '/',
    as: '/',
  }),
  about: () => ({
    href: '/about',
    as: '/about',
  }),
};
