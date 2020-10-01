// @ts-nocheck
// ^ sorry, future self

import pull from 'lodash/pull';
import remove from 'lodash/remove';
import { getMetaFunction } from 'metaes/metafunction';

import {
  Continuation,
  ErrorContinuation,
  ASTNode,
} from 'metaes/types';
import { StackFrame, Timeout } from 'modules/meta/types';
import formatNodeName from './formatNodeName';

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
  let anyMfn = mfn1 ?? mfn2;

  if (anyMfn) {
    const argNames = [
      ...(mfn1 ? mfn1.e?.id?.name || [`<fn>`] : []),
      ...(mfn2 ? mfn2.e?.id?.name || [`<fn>`] : []),
    ].join(', ');

    const name = `${kind}(${argNames})`;

    return anyMfn.config.asyncRuntime.registerPromise({
      name,
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

export function eventLoop({
  handleEvaluationEnd,
  runMetaFunction,
}: {
  handleEvaluationEnd: () => void;
  runMetaFunction: (
    fn: Function,
    args: any,
    done?: Function,
    fail?: Function,
  ) => void;
}) {
  const state = {
    idCtr: 0,
    inFlightPromises: [],
    programTimers: [],
    microtaskQueue: [],
    callbackQueue: [],
  };

  const _clearTimeout = (timer: number, c: () => void) => {
    remove(state.programTimers, (t) => t.timer === timer);
    clearTimeout(timer);
    c();
  };

  const _setTimeout = function (fn: Function, ms: number) {
    const timer = (setTimeout as Timeout)(() => {
      remove(state.programTimers, (t) => t.timer === timer);

      state.callbackQueue.push({
        id: state.idCtr++,
        name: 'setTimeout()',
        type: 'Timeout',
        fn: () => {
          runMetaFunction(fn, []);
        },
      });

      handleEvaluationEnd();
    }, ms);

    state.programTimers.push({
      id: state.idCtr++,
      name: 'setTimeout',
      type: 'Timeout',
      timer,
    });
    return timer;
  };

  const enqueueCallback = (
    fn: Function,
    args: any[],
    done: Function,
    fail: Function,
    p: any,
    name: string,
  ) => {
    if (p) {
      pull(state.inFlightPromises, p);
    }
    state.callbackQueue.push({
      id: state.idCtr++,
      name: name,
      type: `PromiseHandle`,
      fn: () => runMetaFunction(fn, args, done, fail),
    });

    handleEvaluationEnd();
  };

  const registerPromise = (p: any) => {
    const p_ = { ...p, id: state.idCtr++ };
    state.inFlightPromises.push(p_);
    return p_;
  };

  const handleTick = () => {
    let nextCb;

    if (state.microtaskQueue.length) {
      nextCb = state.microtaskQueue.shift();
    } else if (state.callbackQueue.length) {
      nextCb = state.callbackQueue.shift();
    }

    if (nextCb !== undefined) {
      nextCb.fn();
      return true;
    }

    return false;
  };

  const handleAwait = (
    node: ASTNode,
    stackFrame: StackFrame,
    promise: Promise<unknown>,
    c: Continuation,
    cerr: ErrorContinuation,
  ) => {
    const p = {
      id: state.idCtr++,
      name: `suspend ${stackFrame.fnName}()`,
      type: 'AwaitSuspend',
      node,
      promise,
    };

    const cbEntry = (fn) => ({
      id: state.idCtr++,
      name: `resume ${formatNodeName(stackFrame.node)}()`,
      type: 'AsyncFunction',
      node,
      fn,
    });

    promise.then(
      (value: unknown) => {
        pull(state.inFlightPromises, p);
        state.microtaskQueue.push(cbEntry(() => c(value)));
        handleEvaluationEnd();
      },
      (error) => {
        pull(state.inFlightPromises, p);
        state.microtaskQueue.push(
          cbEntry(() => cerr(error)),
        );
        handleEvaluationEnd();
      },
    );
  };

  const reset = () => {
    state.programTimers.forEach((t: any) =>
      clearTimeout(t.timer),
    );
    state.programTimers = [];
  };

  return {
    state,
    handleAwait,
    handleTick,
    enqueueCallback,
    registerPromise,
    deferred,
    reset,
    actions: {
      setTimeout: _setTimeout,
      clearTimeout: _clearTimeout,
    },
  };
}
