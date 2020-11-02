import { where, what } from 'config/site';

export default function About() {
  return (
    <>
      <h2>/about</h2>
      <p>
        Hi, I'm <strong>Mark</strong>. 👋🏼 I'm currently{' '}
        <strong>{what}</strong> in <strong>{where}</strong>.
      </p>
      <p>
        This blog is just getting started, but please check
        back soon!
      </p>
    </>
  );
}
