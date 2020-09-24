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

export const ErrorSymbol = (typeof Symbol === 'function'
  ? Symbol
  : (_: string) => _)('__error__');

const wrapHandler = (
  handler: Function,
  done: Function,
  fail: Function,
  promiseHandle: any,
) => {
  return (value: unknown) => {
    if (!handler) {
      return done(value);
    }

    const mfn = getMetaFunction(handler);

    if (mfn) {
      mfn.config.asyncRuntime.enqueueCallback(
        handler,
        [value],
        done,
        fail,
        promiseHandle,
        promiseHandle.name ?? `<fn>`,
      );

      return;
    }

    // TODO: handle external?
    try {
      const r = handler(value);
      if (r && r.then) {
        r.then(done, fail);
      } else {
        done(r);
      }
    } catch (error) {
      fail(error);
    }
  };
};

const toPromiseHandle = (
  kind: string,
  dfd: ReturnType<typeof deferred>,
  m?: Function,
  n?: Function,
) => {
  const mfn1 = n ? getMetaFunction(n as Function) : null;
  const mfn2 = m ? getMetaFunction(m as Function) : null;
  let mfn = mfn1 ?? mfn2;

  if (mfn) {
    return mfn.config.asyncRuntime.registerPromise({
      name: `${kind}(${mfn.e?.id?.name ?? `<fn>`})`,
      type: kind,
      promise: dfd.promise,
    });
  }
};

function deferred() {
  let resolve: (v: unknown) => void,
    reject: (v: unknown) => void;

  const promise = new Promise((resolve_, reject_) => {
    resolve = resolve_;
    reject = reject_;
  });

  const _then = promise.then.bind(promise);
  const _catch = promise.catch.bind(promise);

  (promise as any).then = (
    onfulfilled: any,
    onrejected: any,
  ) => {
    const dfd = deferred();
    const promiseHandle = toPromiseHandle(
      'then',
      dfd,
      onfulfilled,
      onrejected,
    );

    _then(
      wrapHandler(
        onfulfilled,
        dfd.resolve,
        dfd.reject,
        promiseHandle,
      ),
      wrapHandler(
        onrejected,
        dfd.resolve,
        dfd.reject,
        promiseHandle,
      ),
    );

    return dfd.promise;
  };

  promise.catch = (onRejected: any) => {
    const dfd = deferred();

    _catch(
      wrapHandler(
        onRejected,
        dfd.resolve,
        dfd.reject,
        toPromiseHandle(
          'catch',
          dfd,
          onRejected,
          undefined,
        ),
      ),
    );

    return dfd.promise;
  };

  const deferredObj = {
    done: false,
    value: undefined as unknown,
    error: undefined as unknown,
    promise,
    resolve: (v: unknown) => {
      deferredObj.value = v;
      resolve(v);
      return promise;
    },
    reject: (v: unknown) => {
      deferredObj.error = v;
      reject(v);
      return promise;
    },
  };

  return deferredObj;
}

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

export const createMetaFunction = (
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
