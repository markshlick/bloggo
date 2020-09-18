/* 

This is largely copied from metaes because it doesn't expose the Esprima jsx option

*/

import { nextScriptId, safeEvaluate } from 'metaes';
import { toEnvironment } from 'metaes/environment';
import { ECMAScriptInterpreters } from 'metaes/interpreters';
import { parse } from 'metaes/parse';
import {
  Continuation,
  ErrorContinuation,
  Script,
} from 'metaes/types';

export function noop() {}

const BaseConfig = {
  interpreters: ECMAScriptInterpreters,
  interceptor: noop,
};

const parseAndEvaluate = (
  input: string,
  c?: Continuation<any>,
  cerr?: ErrorContinuation,
  env = {},
  config = {},
) => {
  const scriptId = nextScriptId();

  const opts = { jsx: true } as any;

  const script: Script = {
    source: input,
    ast: parse(input, opts, undefined, true),
    scriptId,
    isModule: true,
  };

  safeEvaluate(
    function inject() {
      return {
        script,
        config: { ...BaseConfig, ...config },
        env: toEnvironment(env),
      };
    },
    c,
    cerr,
  );
};

export { parseAndEvaluate };
