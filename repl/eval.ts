import { metaesEval } from 'metaes';
import { ECMAScriptInterpreters } from 'metaes/interpreters';
import {
  globalObjects,
  interpreters,
} from 'modules/meta/config';

export const evaluate = (code: string) =>
  new Promise((resolve, reject) =>
    metaesEval(code, resolve, reject, globalObjects, {
      interpreters: {
        prev: ECMAScriptInterpreters,
        values: interpreters,
      },
    }),
  );

export default async function run(f: Function) {
  try {
    const x = await evaluate(`;(${f.toString()})();`);
    console.log(x);
  } catch (error) {
    console.log(error);
  }
}

run(function () {
  for (let a in { a: 1, b: 2 }) {
    console.log(a);
  }
});
