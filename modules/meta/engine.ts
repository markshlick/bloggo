import React, { createElement } from 'react';
import { noop } from 'metaes';
import {
  Continuation,
  ErrorContinuation,
  Environment,
  EvaluationConfig,
  Evaluation,
  ASTNode,
  Interpreter,
} from 'metaes/types';
import {
  JavaScriptASTNode,
  ExpressionStatement,
} from 'metaes/nodeTypes';
import { ECMAScriptInterpreters } from 'metaes/interpreters';
import { SetValue } from 'metaes/environment';
import {
  createMetaFunctionWrapper,
  getMetaFunction,
} from 'metaes/metafunction';
import { evaluate } from 'metaes/evaluate';
import { liftedAll } from 'metaes/callcc';
import omit from 'lodash/omit';
import jsxInterpreters from 'modules/meta/jsxInterpreters';
import { parseAndEvaluate } from 'modules/meta/evaluate';
import {
  Apply,
  ArrowFunctionExpression,
  FunctionExpression,
  FunctionDeclaration,
  AwaitExpression,
} from 'modules/meta/metafunction';

type Timeout = (fn: () => void, ms: number) => number;

const blockScopeTypes = [
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
] as const;

const prettyBlockScopeTypeNames: {
  [name in typeof blockScopeTypes[number]]: string;
} = {
  IfStatement: 'if { }',
  ForStatement: 'for { }',
  ForInStatement: 'for { in }',
  ForOfStatement: 'for { of }',
  WhileStatement: 'while { }',
};

type ExecState = {
  // awaitCount: number;
  callStack: StackFrame[];
  autoStepping: boolean;
  running: boolean;
  speed: number;
  nextTimer?: number;
  next?: () => any;
  programTimers: Set<number>;
  programIntervals: Set<number>;
  inFlightPromises: Set<Promise<unknown>>;
  allStackNodes: StackFrame[];
  watchValues: WatchValues;
  callsRootImmutableRef: StackFrame[];
  programEnvKeys: string[];
  callbackQueue: Function[];
};

export type BlockFrame = {
  id: string;
  type: typeof blockScopeTypes;
  sourceId?: string;
  allBlocks: BlockFrame[];
  calls: StackFrame[];
  children: (BlockFrame | StackFrame)[];
};

export type StackFrame = {
  children: (BlockFrame | StackFrame)[];
  id: string;
  name: string;
  fnName: string;
  args: any[];
  values: {
    [key: string]: any;
  };
  returnValue: any;
  calls: StackFrame[];
  origins: Record<string, ASTNode>;
  hasReturned: boolean;
  sourceId: string;
  blockStack: BlockFrame[];
  allBlocks: BlockFrame[];
};

export type WatchValues = Record<
  string,
  { frame: StackFrame; value: any }[]
>;

export type Origin = {
  node: ASTNode;
  frame: StackFrame;
};

export type EvaluationContext = {
  origin?: Origin;
  previousFrame?: StackFrame[];
};

export type Engine = {
  speed: number;
  handleError: (err: any) => void;
  displayEvaluation: (
    evaluation: Evaluation,
    frame: StackFrame,
    context: EvaluationContext,
  ) => void;
  update: () => void;
};

export const interestingTypes: NodeNames[] = [
  'VariableDeclarator',
  'CallExpression',
  'AssignmentExpression',
  'UpdateExpression',
  'ConditionalExpression',
  'ReturnStatement',
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'AwaitExpression',
  'Apply',
  'ExpressionStatement',
];

const globalObjects = {
  Number,
  Boolean,
  Array,
  Object,
  Function,
  String,
  RegExp,
  Date,
  Math,
  Map,
  Set,
  WeakMap,
  WeakSet,
  Error,
  parseInt,
  parseFloat,
  isNaN,
  JSON,
  console,
  Promise,
  React,
};

type NodeNames =
  | keyof typeof ECMAScriptInterpreters.values
  | 'AwaitExpression';

const blankFrameState = () => ({
  origins: {},
  args: [],
  calls: [],
  children: [],
  values: {},
  allBlocks: [],
  blockStack: [],
  hasReturned: false,
  returnValue: undefined,
});

const programFrame = (): StackFrame => ({
  ...blankFrameState(),
  fnName: 'Program',
  id: '-1',
  name: '-1',
  sourceId: 'Program!',
});

export const ErrorSymbol = (typeof Symbol === 'function'
  ? Symbol
  : (_: string) => _)('__error__');

export function meta({
  speed,
  handleError,
  displayEvaluation,
  update,
}: Engine) {
  // helpers
  const execState: ExecState = {
    speed,
    // awaitCount: 0,
    autoStepping: false,
    running: false,
    next: undefined,
    nextTimer: undefined,
    programTimers: new Set(),
    programIntervals: new Set(),
    inFlightPromises: new Set(),
    watchValues: {},
    programEnvKeys: [],
    callbackQueue: [],
    callStack: [],
    allStackNodes: [],
    // TODO: move this outside of this component
    callsRootImmutableRef: [],
  };

  const currentFrame = () =>
    execState.callStack[execState.callStack.length - 1];

  const prevFrame = () =>
    execState.callStack[execState.callStack.length - 2];

  const exceptionHandler = (exception: any) => {
    if (exception.type === 'AsyncEnd') {
      maybeEndExec();
    } else {
      handleError(exception);
    }
  };

  const makeHooks = () => {
    const runMetaFunction = (fn: Function) => {
      const { e, closure, config } = getMetaFunction(fn);

      evaluate(
        { e, fn, type: 'Apply', args: [] },
        maybeEndExec,
        exceptionHandler,
        closure,
        config,
      );
    };

    return liftedAll({
      createElement: (
        [tag, ...rest]: [any, any[]],
        c: (next: any) => void,
        cerr: (next: any) => void,
      ) => {
        const el = createElement(tag, ...rest);

        const mfn = getMetaFunction(tag);
        const fn = createMetaFunctionWrapper({
          ...mfn,
          config: {
            interceptor: noop,
            interpreters: {
              prev: { values: getInterpreters() },
              values: {
                ...makeNodeHandlers(interestingTypes),
              },
            },
          },
        });

        const fakeEl = {
          ...el,
          type: () => {
            return createElement(fn, ...rest);
          },
        };

        c(fakeEl);
      },
      clearTimeout: (timer: number, c: () => void) => {
        execState.programTimers.delete(timer);
        clearTimeout(timer);
        c();
      },
      clearInterval: (timer: number, c: () => void) => {
        execState.programIntervals.delete(timer);
        clearInterval(timer);
        c();
      },
      setTimeout: function (
        [fn, ms]: [() => void, number],
        c: (next: any) => void,
      ) {
        const timer = (setTimeout as Timeout)(() => {
          execState.programTimers.delete(timer);

          execState.callbackQueue.push(() => {
            runMetaFunction(fn);
          });
        }, ms);

        execState.programTimers.add(timer);

        return c(timer);
      },
      setInterval: function (
        [fn, ms]: [() => void, number],
        c: (next: any) => void,
      ) {
        const timer = (setInterval as Timeout)(() => {
          execState.callbackQueue.push(() =>
            runMetaFunction(fn),
          );
        }, ms);

        execState.programIntervals.add(timer);

        return c(timer);
      },
    });
  };

  const step = (
    node: JavaScriptASTNode,
    c: Continuation,
    cerr: ErrorContinuation,
    env: Environment,
    config: EvaluationConfig,
  ) => {
    const next = () => {
      execState.next = undefined;
      // @ts-ignore
      const interpreter: Interpreter<any> = getInterpreters()[
        node.type
      ];

      interpreter(
        node,
        (r: any) => {
          const context: EvaluationContext = {};
          if (
            node.type === 'AssignmentExpression' &&
            node.left.type === 'Identifier'
          ) {
            context.origin = getOrigin(node.left.name);
          }

          displayEvaluation(
            {
              e: node,
              // @ts-ignore
              phase: 'value',
              value: r,
              config,
              env,
            },
            currentFrame(),
            context,
          );

          if (
            node.type === 'Program' ||
            node.type === 'VariableDeclarator' ||
            node.type === 'AssignmentExpression' ||
            // FIXME - override node types
            // @ts-ignore
            node.type === 'AwaitExpression'
          ) {
            enqueue(() => {
              execState.next = undefined;
              c(r);
            });
          } else {
            c(r);
          }
        },
        (err) => {
          const isAwait =
            // @ts-ignore
            node.type === 'AwaitExpression' &&
            err.value instanceof Promise;

          const isReturn =
            node.type === 'ReturnStatement' &&
            // @ts-ignore
            err.type === 'ReturnStatement';

          if (isAwait) {
            handleAwait(err.value, (value) => {
              displayEvaluation(
                {
                  e: node,
                  // @ts-ignore
                  phase: 'value',
                  value: err,
                  config,
                  env,
                },
                currentFrame(),
                {},
              );
              enqueue(() => {
                execState.next = undefined;
                c(value);
              });
            });
          }

          if (
            // @ts-ignore
            isAwait ||
            isReturn
          ) {
            displayEvaluation(
              {
                e: node,
                // @ts-ignore
                phase: 'value',
                value: err,
                config,
                env,
              },
              currentFrame(),
              {},
            );

            enqueue(() => {
              execState.next = undefined;
              cerr(err);
            });
          } else {
            cerr(err);
          }
        },
        env,
        config,
      );
    };

    // TODO: expose this as a callback?
    const isApplyWithoutMetaFn =
      node.type === 'Apply' && !getMetaFunction(node.fn)?.e;

    if (
      // HACK: Program statements (not interesting) are handled as BlockStatements by the interpreter
      node.type === 'Program' ||
      node.type === 'VariableDeclarator' ||
      node.type === 'ReturnStatement' ||
      node.type === 'AssignmentExpression' ||
      node.type === 'ExpressionStatement' ||
      // @ts-ignore
      node.type === 'AwaitExpression' ||
      isApplyWithoutMetaFn
    ) {
      next();
    } else {
      enqueue(next);
    }
  };

  const getInterpreters = () => {
    return {
      ...ECMAScriptInterpreters.values,
      ...jsxInterpreters,
      SetValue: handleSetValue,
      Apply,
      ArrowFunctionExpression,
      FunctionExpression,
      FunctionDeclaration,
      AwaitExpression,
    };
  };

  const makeNodeHandlers = (names: NodeNames[]) => {
    const map: Partial<{ [name in NodeNames]: any }> = {};

    for (const name of names) {
      map[name] = step;
    }

    return map;
  };

  const enqueue = (next: () => any) => {
    execState.next = next;

    if (execState.autoStepping) {
      const run = () => {
        if (execState.autoStepping) {
          next();
        }
      };

      execState.nextTimer = (setTimeout as Timeout)(
        run,
        execState.speed,
      );
    }
  };

  const currentBlock = () => {
    const frame = currentFrame();
    return frame.blockStack[frame.blockStack.length - 1];
  };

  const getOrigin = (name: string) => {
    for (
      let index = execState.callStack.length - 1;
      index >= 0;
      index--
    ) {
      const frame = execState.callStack[index];
      const node = frame.origins[name];
      if (node) {
        return {
          node,
          frame,
        };
      }
    }
  };

  const updateStackState = (evaluation: Evaluation) => {
    console.log(
      evaluation.e.type,
      evaluation,
      currentFrame(),
      currentBlock(),
    );

    const evaluationType = evaluation.e.type;
    if (blockScopeTypes.includes(evaluationType)) {
      const stackFrame = currentFrame();
      if (evaluation.phase === 'enter') {
        const blockFrame = {
          // @ts-ignore
          fnName: prettyBlockScopeTypeNames[evaluationType],
          id: `${stackFrame.id}-${stackFrame.allBlocks.length}`,
          type: evaluation.e.type,
          sourceId: evaluation.e.range?.join(),
          allBlocks: [],
          calls: [],
          children: [],
        };

        const prevBlock = currentBlock();

        if (!prevBlock) {
          stackFrame.allBlocks.push(blockFrame);
          stackFrame.children.push(blockFrame);
        } else {
          prevBlock.allBlocks.push(blockFrame);
          prevBlock.children.push(blockFrame);
        }

        execState.callsRootImmutableRef = [
          ...execState.callsRootImmutableRef,
        ];

        stackFrame.blockStack.push(blockFrame);

        // displayBlockEnter(evaluation, blockFrame, frame);
      } else {
        // displayBlockExit(evaluation, blockFrame, frame);
        stackFrame.blockStack.pop();
      }
    }

    const fnName =
      evaluation.e?.e?.callee?.name ||
      evaluation.e?.e?.id?.name;

    if (fnName && evaluation.e.type === 'Apply') {
      if (evaluation.phase === 'enter') {
        const metaFn = getMetaFunction(evaluation.e.fn)?.e;

        const id = `${execState.allStackNodes.length}`;
        const frame = {
          ...blankFrameState(),
          fnName,
          id,
          name: id,
          args: evaluation.e.args,
          sourceId: metaFn?.range?.join(),
          env: evaluation.env,
        };

        currentFrame().calls.push(frame);
        currentBlock()?.calls.push(frame);
        (currentBlock() || currentFrame())?.children.push(
          frame,
        );

        execState.callStack.push(frame);
        execState.allStackNodes.push(frame);
        execState.callsRootImmutableRef = [
          ...execState.callsRootImmutableRef,
        ];

        displayEvaluation(
          {
            ...evaluation,
            // @ts-ignore
            phase: 'enter-after',
          },
          currentFrame(),
          { previousFrame: prevFrame() },
        );
      } else {
        currentFrame().hasReturned = true;
        currentFrame().returnValue = evaluation.value;

        displayEvaluation(
          {
            ...evaluation,
            // @ts-ignore
            phase: 'exit-before',
          },
          currentFrame(),
          { previousFrame: prevFrame() },
        );

        execState.callStack.pop();
        execState.callsRootImmutableRef = [
          ...execState.callsRootImmutableRef,
        ];
      }
    } else {
      const frame = currentFrame();

      if (frame.id === '-1') {
        const values = omit(
          evaluation.env?.values ?? {},
          execState.programEnvKeys,
        );

        frame.values = { ...frame.values, ...values };
      } else {
        let env = evaluation.env;

        // HACK
        // @ts-ignore
        while (env && env !== frame.env) {
          frame.values = { ...frame.values, ...env.values };
          env = env.prev;
        }
      }
    }

    if (
      evaluation.phase === 'enter' &&
      evaluation.e.type === 'VariableDeclarator'
    ) {
      const frame = currentFrame();
      const declaration = evaluation.e;
      if (
        declaration.id &&
        declaration.id.type === 'Identifier'
      ) {
        frame.origins[declaration.id.name] = evaluation.e;
      }
    }

    const isInteresting = interestingTypes.includes(
      evaluation.e.type,
    );

    if (isInteresting) {
      displayEvaluation(evaluation, currentFrame(), {});
      update();
    }
  };

  const handleSetValue = (
    e: {
      name: string;
      value: any;
      isDeclaration: boolean;
    },
    c: Continuation,
    cerr: ErrorContinuation,
    env: Environment,
  ) => {
    const frame = currentFrame();
    const k = `${frame?.fnName ?? ''}:${e.name}`;
    execState.watchValues[k] =
      execState.watchValues[k] ?? [];
    execState.watchValues[k].push({
      frame,
      value: e.value,
    });

    SetValue(e, c, cerr, env);
  };

  // exec

  const startExec = (code: string) => {
    if (execState.running) {
      return;
    }

    const rootFrame = programFrame();
    execState.callStack = [rootFrame];
    execState.allStackNodes = [];
    execState.watchValues = {};

    // cheating a bit here to optimize react-d3-tree rendering
    // callsRootImmutableRef is an immutable *reference*
    // BUT it's values mutate
    // NOTE - it will not be reassigned if stack frame variable change
    execState.callsRootImmutableRef = [rootFrame];

    execState.running = true;

    const programEnv = {
      ...makeHooks(),
      ...globalObjects,
    };

    const programEnvKeys = Object.keys(programEnv);
    execState.programEnvKeys = programEnvKeys;

    parseAndEvaluate(
      code,
      maybeEndExec,
      exceptionHandler,
      programEnv,
      {
        interceptor: updateStackState,
        interpreters: {
          prev: {
            values: getInterpreters(),
          },
          values: {
            ...makeNodeHandlers(interestingTypes),
          },
        },
      },
    );
  };

  const handleAwait = (
    promise: Promise<unknown>,
    c: Continuation,
  ) => {
    const stack = [...execState.callStack];
    // execState.awaitCount++;
    execState.inFlightPromises.add(promise);
    promise.then((value: unknown) => {
      // execState.awaitCount--;
      execState.inFlightPromises.delete(promise);
      execState.callbackQueue.push(() => {
        execState.callStack = stack;
        c(value);
      });
    });
  };

  const maybeEndExec = () => {
    if (execState.callbackQueue.length) {
      const next = execState.callbackQueue.shift();
      if (next) next();
      return;
    }

    if (execState.inFlightPromises.size) {
      Promise.race(
        Array.from(execState.inFlightPromises.values()),
      ).then(maybeEndExec);
      return;
    }

    if (
      !execState.programTimers.size &&
      !execState.programIntervals.size &&
      !execState.callbackQueue.length &&
      !execState.next
    ) {
      endExec();
    }
  };

  const endExec = () => {
    execState.nextTimer &&
      clearTimeout(execState.nextTimer);

    execState.programTimers.forEach((t) => clearTimeout(t));

    execState.programIntervals.forEach((t) =>
      clearInterval(t as any),
    );

    execState.autoStepping = false;
    execState.running = false;
    execState.next = undefined;

    update();
  };

  const progressExec = () => {
    if (execState.next) {
      execState.next();
    } else {
      maybeEndExec();
    }
  };

  const setSpeed = (speed: number) =>
    (execState.speed = speed);

  return {
    execState,
    currentFrame,
    startExec,
    maybeEndExec,
    endExec,
    progressExec,
    setSpeed,
  };
}
