import { evaluate } from 'metaes/evaluate';
import { LocatedError } from 'metaes/exceptions';
import {
  Continuation,
  ErrorContinuation,
  EvaluationConfig,
  Environment,
} from 'metaes/types';
import * as NodeTypes from 'metaes/nodeTypes';
import {
  getMetaFunction,
  isMetaFunction,
} from 'metaes/metafunction';

import {
  createMetaFunction,
  ErrorSymbol,
  evaluateMetaFunction,
} from 'modules/meta/metafunction';

export function ArrowFunctionExpression(
  e: NodeTypes.ArrowFunctionExpression,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  createMetaFunction(e, c, cerr, env, config);
}

export function FunctionExpression(
  e: NodeTypes.FunctionExpression,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  createMetaFunction(e, c, cerr, env, config);
}

export function FunctionDeclaration(
  e: NodeTypes.FunctionDeclaration,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  createMetaFunction(e, c, cerr, env, config);
}
const EXCEPTION_NAME = '/exception';

export function TryStatement(
  e: NodeTypes.TryStatement,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  evaluate(
    e.block,
    c,
    (exception) => {
      if (exception.type === 'AwaitExpression') {
        cerr(exception);
        return;
      }

      return evaluate(
        e.handler,
        () =>
          e.finalizer
            ? evaluate(e.finalizer, c, cerr, env, config)
            : // @ts-ignore
              c(),
        cerr,
        {
          values: {
            [EXCEPTION_NAME]: exception.value || exception,
          },
          prev: env,
        },
        config,
      );
    },
    env,
    config,
  );
}

export const AwaitExpression = (
  e: {
    argument: NodeTypes.ExpressionStatement;
  },
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) => {
  evaluate(
    e.argument,
    (value) => {
      if (value instanceof Promise) {
        cerr({
          type: 'AwaitExpression',
          value: value,
          [ErrorSymbol]: true,
        });
      } else {
        c(value);
      }
    },
    cerr,
    env,
    config,
  );
};

export function Apply(
  { fn, thisValue, args }: NodeTypes.Apply,
  c: Continuation,
  cerr: ErrorContinuation,
  _env: Environment,
  config: EvaluationConfig,
) {
  try {
    if (isMetaFunction(fn)) {
      evaluateMetaFunction(
        getMetaFunction(fn),
        c,
        cerr,
        thisValue,
        args,
        config,
      );
    } else {
      c(fn.apply(thisValue, args));
    }
  } catch (e) {
    cerr(e);
  }
}
