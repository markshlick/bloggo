// @ts-nocheck
// ^ sorry, future self

import pull from 'lodash/pull';
import remove from 'lodash/remove';

import {
  Continuation,
  ErrorContinuation,
  ASTNode,
} from 'metaes/types';
import { StackFrame, Timeout } from 'modules/meta/types';

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
      type: `PromiseHandler`,
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
    const nextCb = state.callbackQueue.shift();

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
      name: `${stackFrame.fnName}() `,
      type: 'AsyncFunction',
      node,
      fn,
    });

    promise.then(
      (value: unknown) => {
        pull(state.inFlightPromises, p);
        state.callbackQueue.push(cbEntry(() => c(value)));
        handleEvaluationEnd();
      },
      (error) => {
        pull(state.inFlightPromises, p);
        state.callbackQueue.push(
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
    reset,
    actions: {
      setTimeout: _setTimeout,
      clearTimeout: _clearTimeout,
    },
  };
}
