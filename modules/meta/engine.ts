import React, { createElement } from 'react';
import { noop } from 'metaes';
import {
  Continuation,
  ErrorContinuation,
  Environment,
  EvaluationConfig,
  Evaluation,
  ASTNode,
} from 'metaes/types';
import { JavaScriptASTNode } from 'metaes/nodeTypes';
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
  callStack: StackFrame[];
  autoStepping: boolean;
  running: boolean;
  speed: number;
  nextTimer?: number;
  next?: () => any;
  programTimers: Set<number>;
  programIntervals: Set<number>;
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
};

export type Engine = {
  speed: number;
  handleError: (err: any) => void;
  displayApplyEnter: (
    evaluation: Evaluation,
    frame: StackFrame,
    prevFrame: StackFrame,
  ) => void;
  displayApplyExit: (
    evaluation: Evaluation,
    frame: StackFrame,
    prevFrame: StackFrame,
  ) => void;
  displayEvaluation: (
    evaluation: Evaluation,
    frame: StackFrame,
    context: EvaluationContext,
  ) => void;
  update: () => void;
};

export const interestingTypes: NodeNames[] = [
  'Apply',
  'VariableDeclarator',
  'CallExpression',
  'AssignmentExpression',
  'UpdateExpression',
  'ConditionalExpression',
  //
  'ReturnStatement',
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
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
  React,
};

type NodeNames = keyof typeof ECMAScriptInterpreters.values;

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

const elog = (evaluation: Evaluation) => {
  const type = evaluation.e.type;
  if (
    ![
      'GetValue',
      'SetValue',
      'Identifier',
      'Literal',
    ].includes(type)
  ) {
    console.log(evaluation.e.type, evaluation);
  }
};

const baseEvalConfig = {
  interceptor: noop,
  interpreters: {
    prev: ECMAScriptInterpreters,
    values: {
      ...jsxInterpreters,
    },
  },
};

export function meta({
  speed,
  handleError,
  displayApplyEnter,
  displayApplyExit,
  displayEvaluation,
  update,
}: Engine) {
  // helpers
  const execState: ExecState = {
    speed,
    autoStepping: false,
    running: false,
    next: undefined,
    nextTimer: undefined,
    programTimers: new Set(),
    programIntervals: new Set(),
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

  const makeHooks = () => {
    const runMetaFunction = (fn: Function) => {
      const { e, closure, config } = getMetaFunction(fn);

      evaluate(
        { e, fn, type: 'Apply', args: [] },
        maybeEndExec,
        handleError,
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
          config: baseEvalConfig,
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
      const f = (ECMAScriptInterpreters.values as any)[
        node.type
      ];

      f(
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

          const next2 = () => {
            execState.next = undefined;
            c(r);
          };

          if (
            node.type === 'Program' ||
            node.type === 'VariableDeclarator' ||
            node.type === 'AssignmentExpression'
          ) {
            enqueue(next2);
          } else {
            next2();
          }
        },
        cerr,
        env,
        config,
      );
    };

    if (
      // HACK: Program statements (not interesting) are handled as BlockStatements by the interpreter
      node.type === 'Program' ||
      node.type === 'VariableDeclarator' ||
      node.type === 'AssignmentExpression'
    ) {
      next();
    } else {
      enqueue(next);
    }
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

        displayApplyEnter(evaluation, frame, prevFrame());
      } else {
        currentFrame().hasReturned = true;
        currentFrame().returnValue = evaluation.value;

        displayApplyExit(
          evaluation,
          currentFrame(),
          prevFrame(),
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

    displayEvaluation(evaluation, currentFrame(), {});

    update();
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
      handleError,
      programEnv,
      {
        interceptor: updateStackState,
        interpreters: {
          prev: ECMAScriptInterpreters,
          values: {
            ...makeNodeHandlers(interestingTypes),
            ...jsxInterpreters,
            SetValue: handleSetValue,
          },
        },
      },
    );
  };

  const maybeEndExec = () => {
    if (execState.callbackQueue.length) {
      const next = execState.callbackQueue.shift();
      if (next) next();
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
