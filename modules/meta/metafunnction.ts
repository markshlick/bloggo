import { evaluate, visitArray } from 'metaes/evaluate';
import {
  NotImplementedException,
  toException,
  LocatedError,
} from 'metaes/exceptions';
import { FunctionNode } from 'metaes/nodeTypes';
import {
  markAsMetaFunction,
  isMetaFunction,
  getMetaFunction,
} from 'metaes/metafunction';
import {
  Continuation,
  ErrorContinuation,
  EvaluationConfig,
  MetaesFunction,
  Environment,
} from 'metaes/types';
import * as NodeTypes from 'metaes/nodeTypes';

function deferred() {
  let resolve: (v: unknown) => void,
    reject: (v: unknown) => void;
  const promise = new Promise((resolve_, reject_) => {
    resolve = resolve_;
    reject = reject_;
  });

  const d = {
    value: undefined as unknown,
    error: undefined as unknown,
    promise,
    resolve: (v: unknown) => {
      d.value = v;
      resolve(v);
      return promise;
    },
    reject: (v: unknown) => {
      d.error = v;
      reject(v);
      return promise;
    },
  };

  return d;
}

// TODO: move to interpreter style
export const evaluateMetaFunction = (
  metaFunction: MetaesFunction,
  c: Continuation,
  cerr: ErrorContinuation,
  thisObject: any,
  args: any[],
  executionTimeConfig?: EvaluationConfig,
) => {
  const { e, closure, config } = metaFunction;
  const env = {
    prev: closure,
    values: { this: thisObject, arguments: args } as {
      [key: string]: any;
    },
  };
  let i = 0;
  visitArray(
    e.params,
    function nextMetaFunctionParam(param, c, cerr) {
      switch (param.type) {
        case 'Identifier':
          c((env.values[param.name] = args[i++]));
          break;
        case 'RestElement':
          c(
            (env.values[param.argument.name] = args.slice(
              i++,
            )),
          );
          break;
        case 'ObjectPattern':
          evaluate(
            param,
            c,
            cerr,
            {
              values: args[i++],
              prev: env,
              internal: true,
            },
            config,
          );
          break;
        default:
          cerr(
            NotImplementedException(
              `"${param['type']}" is not supported type of function param.`,
              param,
            ),
          );
      }
    },
    () => {
      let returnDeferred:
        | ReturnType<typeof deferred>
        | undefined;

      return evaluate(
        e.body,
        (value) => {
          if (
            e.type === 'ArrowFunctionExpression' &&
            e.body.type !== 'BlockStatement'
          ) {
            // use implicit return only if function is arrow function and have expression as a body
            if (returnDeferred) {
              returnDeferred.resolve(value);
              cerr({ type: 'AsyncEnd' });
            } else {
              returnDeferred;
            }
          } else {
            // ignore what was evaluated in function body, return statement in error continuation should carry the value
            if (returnDeferred) {
              cerr({ type: 'AsyncEnd' });
            } else {
              c(undefined);
            }
          }
        },
        (exception) => {
          if (exception.type === 'ReturnStatement') {
            if (returnDeferred) {
              returnDeferred.resolve(exception.value);
              cerr({ type: 'AsyncEnd' });
            } else {
              c(exception.value);
            }
          } else if (exception.type === 'AwaitExpression') {
            returnDeferred = deferred();
            c(returnDeferred.promise);
          } else {
            cerr(exception);
          }
        },
        env,
        // Execution time config takes precedence over function creation time config
        { ...config, ...executionTimeConfig },
      );
    },
    cerr,
  );
};

export const createMetaFunctionWrapper = (
  metaFunction: MetaesFunction,
) => {
  const fn = function (this: any, ...args: unknown[]) {
    let result;
    let exception;
    evaluateMetaFunction(
      metaFunction,
      (r) => (result = r),
      (ex) => (exception = toException(ex)),
      this,
      args,
    );
    if (exception) {
      throw exception;
    }
    return result;
  };

  markAsMetaFunction(fn, metaFunction);
  return fn;
};

export const createMetaFunction = (
  e: FunctionNode,
  closure: Environment,
  config: EvaluationConfig,
) =>
  createMetaFunctionWrapper({
    e,
    closure,
    config,
  });

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

function _createMetaFunction(
  e:
    | NodeTypes.ArrowFunctionExpression
    | NodeTypes.FunctionExpression,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  try {
    c(createMetaFunction(e, env, config));
  } catch (error) {
    cerr(LocatedError(error, e));
  }
}

export function ArrowFunctionExpression(
  e: NodeTypes.ArrowFunctionExpression,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  _createMetaFunction(e, c, cerr, env, config);
}

export function FunctionExpression(
  e: NodeTypes.FunctionExpression,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  _createMetaFunction(e, c, cerr, env, config);
}

export function FunctionDeclaration(
  e: NodeTypes.FunctionDeclaration,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  try {
    c(createMetaFunction(e, env, config));
  } catch (error) {
    cerr(LocatedError(error, e));
  }
}
