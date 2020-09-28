import { parseScript } from 'esprima';
import { inspect } from 'util';

export default async function run(f: Function) {
  try {
    const x = await parseScript(
      `;(${f.toString()})();`,
      {
        comment: true,
        tokens: true,
        loc: true,
        range: true,
      },
      console.log,
    );
    console.log(inspect(x, false, null, true));
  } catch (error) {
    console.log(error);
  }
}

run(function () {
  for (let a in { a: 1, b: 2 }) {
    console.log(a);
  }
});
