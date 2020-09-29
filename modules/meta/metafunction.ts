import { evaluate, visitArray } from 'metaes/evaluate';
import {
  NotImplementedException,
  toException,
  LocatedError,
} from 'metaes/exceptions';
import { FunctionNode } from 'metaes/nodeTypes';
import { markAsMetaFunction } from 'metaes/metafunction';
import {
  Continuation,
  ErrorContinuation,
  EvaluationConfig,
  MetaesFunction,
  Environment,
} from 'metaes/types';
import * as NodeTypes from 'metaes/nodeTypes';

export const ErrorSymbol = (typeof Symbol === 'function'
  ? Symbol
  : (_: string) => _)('__error__');

// TODO: move to interpreter style
export const evaluateMetaFunction = (
  metaFunction: MetaesFunction,
  c: Continuation,
  cerr: ErrorContinuation,
  thisObject: unknown,
  args: unknown[],
  executionTimeConfig?: EvaluationConfig,
) => {
  const { e, closure, config } = metaFunction;
  const env = {
    prev: closure,
    values: { this: thisObject, arguments: args } as {
      [key: string]: unknown;
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
              // @ts-ignore
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
      let returnDeferred: any;

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
              cerr({
                type: 'AsyncEnd',
                value,
                [ErrorSymbol]: true,
              });
            } else {
              c(value);
            }
          } else {
            // ignore what was evaluated in function body, return statement in error continuation should carry the value
            if (returnDeferred) {
              cerr({
                type: 'AsyncEnd',
                value,
                [ErrorSymbol]: true,
              });
            } else {
              c(undefined);
            }
          }
        },
        (exception) => {
          if (exception.type === 'ReturnStatement') {
            if (returnDeferred) {
              returnDeferred.resolve(exception.value);
              cerr({
                type: 'AsyncEnd',
                value: exception.value,
                [ErrorSymbol]: true,
              });
            } else {
              c(exception.value);
            }
          } else if (exception.type === 'AwaitExpression') {
            // @ts-ignore
            returnDeferred = config.asyncRuntime.deferred();

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
  e: FunctionNode,
  closure: Environment,
  config: EvaluationConfig,
) => {
  const metaFunctionExternal: MetaesFunction = {
    e,
    closure,
    config: {
      ...config,
      // @ts-ignore
      external: true,
    },
  };

  const metaFunctionInternal: MetaesFunction = {
    e,
    closure,
    config,
  };

  const fn = function (this: unknown, ...args: unknown[]) {
    let result;
    let exception;
    evaluateMetaFunction(
      metaFunctionExternal,
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

  markAsMetaFunction(fn, metaFunctionInternal);
  return fn;
};

export function createMetaFunction(
  e:
    | NodeTypes.ArrowFunctionExpression
    | NodeTypes.FunctionExpression
    | NodeTypes.FunctionDeclaration,
  c: Continuation,
  cerr: ErrorContinuation,
  env: Environment,
  config: EvaluationConfig,
) {
  try {
    c(createMetaFunctionWrapper(e, env, config));
  } catch (error) {
    cerr(LocatedError(error, e));
  }
}
