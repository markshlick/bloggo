import { metaesEval } from 'metaes';
import {
  Continuation,
  ErrorContinuation,
  Environment,
  EvaluationConfig,
  Evaluation,
} from 'metaes/types';
import { JavaScriptASTNode } from 'metaes/nodeTypes';
import { ECMAScriptInterpreters } from 'metaes/interpreters';
import { SetValue } from 'metaes/environment';
import { getMetaFunction } from 'metaes/metafunction';
import { evaluate } from 'metaes/evaluate';
import { liftedAll } from 'metaes/callcc';
import omit from 'lodash/omit';
import jsxInterpreters from './jsxInterpreters';
import { parseAndEvaluate } from './evaluate';

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
  hasReturned: boolean;
  sourceId: string;
  blockStack: BlockFrame[];
  allBlocks: BlockFrame[];
};

export type WatchValues = Record<
  string,
  { frame: StackFrame; value: any }[]
>;

export const interestingTypes: NodeNames[] = [
  'Apply',
  'CallExpression',
  'AssignmentExpression',
  'ReturnStatement',
  'VariableDeclaration',
  'ExpressionStatement',
  'ConditionalExpression',
  'UpdateExpression',
  //
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
};

type NodeNames = keyof typeof ECMAScriptInterpreters.values;

const programFrame = (): StackFrame => ({
  fnName: 'Program',
  id: '-1',
  name: '-1',
  args: [],
  calls: [],
  children: [],
  values: {},
  hasReturned: false,
  returnValue: undefined,
  sourceId: 'Program!',
  allBlocks: [],
  blockStack: [],
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

export function meta({
  speed,
  handleError,
  displayApplyEnter,
  displayApplyExit,
  displayEvaluation,
  update,
}: {
  speed: number;
  handleError: (err: any) => void;
  displayApplyEnter: (
    evaluation: Evaluation,
    frame: StackFrame,
  ) => void;
  displayApplyExit: (
    evaluation: Evaluation,
    frame: StackFrame,
  ) => void;
  displayEvaluation: (
    evaluation: Evaluation,
    frame: StackFrame,
  ) => void;
  update: () => void;
}) {
  // helpers
  const execState: {
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
  } = {
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
      clearTimeout: (timer: number) => {
        execState.programTimers.delete(timer);
        clearTimeout(timer);
      },
      clearInterval: (timer: number) => {
        execState.programIntervals.delete(timer);
        clearInterval(timer);
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

  const makeNodeHandlers = (names: NodeNames[]) => {
    const map: Partial<{ [name in NodeNames]: any }> = {};

    for (const name of names) {
      map[name] = (
        node: JavaScriptASTNode,
        c: Continuation,
        cerr: ErrorContinuation,
        env: Environment,
        config: EvaluationConfig,
      ) => {
        const next = () => {
          execState.next = undefined;
          const f = ECMAScriptInterpreters.values[
            name
          ] as any;

          f(node, c, cerr, env, config);
        };

        // HACK: Program statements (not interesting) are handled as BlockStatements by the interpreter
        if (node.type === 'Program') {
          next();
          return;
        }

        if (execState.autoStepping) {
          const run = () => {
            if (execState.autoStepping) {
              setTimeout(next, 10);
            }
          };

          execState.nextTimer = (setTimeout as Timeout)(
            run,
            execState.speed,
          );
        }

        execState.next = next;
      };
    }

    return map;
  };

  const currentBlock = () => {
    const frame = currentFrame();
    return frame.blockStack[frame.blockStack.length - 1];
  };

  const updateStackState = (evaluation: Evaluation) => {
    elog(evaluation);

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
          fnName,
          id,
          name: id,
          args: evaluation.e.args,
          calls: [],
          allBlocks: [],
          children: [],
          blockStack: [],
          values: {},
          hasReturned: false,
          returnValue: undefined,
          sourceId: metaFn?.range?.join(),
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

        displayApplyEnter(evaluation, frame);
      } else {
        displayApplyExit(evaluation, currentFrame());
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

        frame.values = values;
      } else {
        frame.values = evaluation.env?.values ?? {};
      }
    }

    displayEvaluation(evaluation, currentFrame());

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

    execState.callStack = [programFrame()];
    execState.allStackNodes = [];
    execState.watchValues = {};

    // cheating a bit here to optimize react-d3-tree rendering
    // callsRootImmutableRef is an immutable *reference*
    // BUT it's values mutate
    // NOTE - it will not be reassigned if stack frame variable change
    execState.callsRootImmutableRef = [
      execState.callStack[0],
    ];

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
