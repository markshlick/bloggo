import {
  Continuation,
  ErrorContinuation,
  Environment,
  EvaluationConfig,
  Evaluation,
  Interpreter,
} from 'metaes/types';
import { JavaScriptASTNode } from 'metaes/nodeTypes';
import { getMetaFunction } from 'metaes/metafunction';
import { evaluate } from 'metaes/evaluate';
import { parseAndEvaluate } from 'modules/meta/evaluate';
import { eventLoop } from 'modules/meta/eventLoop';
import {
  StackFrame,
  Engine,
  ExecState,
  EvaluationContext,
  Timeout,
  blockScopeTypes,
  NodeNames,
  BlockFrame,
  FrameMeta,
} from 'modules/meta/types';
import {
  getInterpreters,
  interestingTypes,
  globalObjects,
  shouldSkipWaitOnEnterPhase,
  shouldWaitOnValuePhase,
} from 'modules/meta/config';
import {
  formatBlockScopeName,
  formatFnName,
} from 'modules/meta/formatNodeName';

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
  node: {
    type: 'Program',
  },
});

export function meta({
  speed,
  handleError,
  onEvaluation,
  onPending,
  update,
}: Engine) {
  // helpers
  const execState: ExecState = {
    speed,
    autoStepping: false,
    running: false,
    next: undefined,
    nextTimer: undefined,
    programEnvKeys: [],
    allStackNodes: [],
    asyncRuntime: eventLoop({
      runMetaFunction: (
        fn: Function,
        args: any = [],
        done?: Function,
        fail?: Function,
      ) => runMetaFunction(fn, args, done, fail),
      handleEvaluationEnd: () => handleEvaluationEnd(),
    }),
    flow: {
      allBlocks: new Map(),
      allFrames: new Map(),
      frameMeta: new Map(),
    },
    stackFrames: [],
  };

  const emitEvaluation = (
    evaluation: Evaluation,
    frame: StackFrame,
    context: EvaluationContext,
  ) => {
    // @ts-ignore
    if (!evaluation.config.external) {
      try {
        onEvaluation(evaluation, frame, context);
      } catch (error) {}
    }
  };

  const runMetaFunction = (
    fn: Function,
    args: any = [],
    done?: Function,
    fail?: Function,
  ) => {
    const { e, closure, config } = getMetaFunction(fn);

    evaluate(
      { e, fn, type: 'Apply', args },
      (value) => {
        if (done) {
          done(value);
        }
        handleEvaluationEnd();
      },
      (ex) => {
        if (fail) {
          fail(ex.value);
        } else {
          exceptionHandler(ex);
        }
        handleEvaluationEnd();
      },
      closure,
      config,
    );
  };

  const currentFrame = () =>
    execState.stackFrames[execState.stackFrames.length - 1]
      .frame;

  const prevFrame = () =>
    execState.stackFrames[execState.stackFrames.length - 2]
      ?.frame;

  const exceptionHandler = (exception: any) => {
    if (exception.type === 'AsyncEnd') {
      handleEvaluationEnd();
    } else {
      handleError(exception);
    }
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

      const continuation: Continuation = (r: any) => {
        const context: EvaluationContext = {
          previousFrame: prevFrame(),
        };

        if (
          node.type === 'AssignmentExpression' &&
          node.left.type === 'Identifier'
        ) {
          context.origin = getOrigin(node.left.name);
        }

        emitEvaluation(
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
          shouldWaitOnValuePhase(node) &&
          // @ts-ignore
          !config.external
        ) {
          enqueue(() => {
            execState.next = undefined;
            c(r);
          });
        } else {
          c(r);
        }
      };

      const errorContinuation: ErrorContinuation = (
        err,
      ) => {
        const isAwait =
          // @ts-ignore
          node.type === 'AwaitExpression' &&
          err.value instanceof Promise;

        const isReturn =
          node.type === 'ReturnStatement' &&
          // @ts-ignore
          err.type === 'ReturnStatement';

        if (isAwait) {
          const resumeEvaluation: Evaluation = {
            e: node,
            // @ts-ignore
            phase: 'resume',
            value: err,
            config,
            env,
          };

          const frames = [...execState.stackFrames];
          execState.asyncRuntime.handleAwait(
            node,
            currentFrame(),
            err.value,
            (value: any) => {
              execState.stackFrames = frames;
              update();
              emitEvaluation(
                resumeEvaluation,
                currentFrame(),
                {},
              );
              enqueue(() => {
                execState.next = undefined;
                c(value);
              });
            },
            (value: any) => {
              execState.stackFrames = frames;
              update();
              emitEvaluation(
                resumeEvaluation,
                currentFrame(),
                {},
              );
              enqueue(() => {
                execState.next = undefined;
                cerr({
                  type: 'ThrowStatement',
                  value: value,
                  location: node,
                });
              });
            },
          );
        }

        if (
          // @ts-ignore
          isAwait ||
          isReturn
        ) {
          emitEvaluation(
            {
              e: node,
              // @ts-ignore
              phase: isAwait ? 'suspend' : 'value',
              value: err,
              config,
              env,
            },
            currentFrame(),
            {},
          );

          if (
            // @ts-ignore
            config.external
          ) {
            cerr(err);
          } else {
            enqueue(() => {
              execState.next = undefined;
              cerr(err);
            });
          }
        } else {
          cerr(err);
        }
      };

      interpreter(
        node,
        continuation,
        errorContinuation,
        env,
        config,
      );
    };

    if (
      // @ts-ignore
      config.external ||
      shouldSkipWaitOnEnterPhase(node)
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
        if (execState.autoStepping && execState.next) {
          execState.next();
        } else {
          update();
        }
      };

      execState.nextTimer = (setTimeout as Timeout)(
        run,
        execState.speed,
      );
    }
  };

  const currentBlock = () => {
    const f =
      execState.stackFrames[
        execState.stackFrames.length - 1
      ];

    const b = f.blockStack[f.blockStack.length - 1];

    return b;
  };

  const getOrigin = (name: string) => {
    for (
      let index = execState.stackFrames.length - 1;
      index >= 0;
      index--
    ) {
      const frame = execState.stackFrames[index].frame;
      const node = execState.flow.frameMeta
        .get(frame.id)
        ?.origins.get(name);

      if (node) {
        return {
          node,
          frame,
        };
      }
    }
  };

  const recordBlock = (evaluation: Evaluation) => {
    const evaluationType = evaluation.e.type;
    if (blockScopeTypes.includes(evaluationType)) {
      if (evaluation.phase === 'enter') {
        const stackFrame = currentFrame();
        const prevBlock = currentBlock();
        const { flow } = execState;

        const block = {
          fnName: formatBlockScopeName(evaluation.e),
          id: `${stackFrame.id}-${flow.allBlocks.size}`,
          type: evaluation.e.type,
          sourceId: evaluation.e.range?.join(),
          node: evaluation.e,
        };

        flow.frameMeta.set(block.id, createFrameMeta());
        prevBlock &&
          flow.frameMeta
            .get(prevBlock.id)
            ?.blocks.push(block.id);
        flow.allBlocks.set(block.id, block);

        pushBlockFrame(block);
      } else {
        popBlockFrame();
      }
    }
  };

  const pushBlockFrame = (block: BlockFrame) => {
    const lastFrame =
      execState.stackFrames[
        execState.stackFrames.length - 1
      ];

    const newLastFrame = {
      ...lastFrame,
      blockStack: [...lastFrame.blockStack, block],
    };

    const newStackFrames = [
      ...execState.stackFrames.slice(0, -1),
      newLastFrame,
    ];

    execState.stackFrames = newStackFrames;
  };

  const popBlockFrame = () => {
    const lastFrame =
      execState.stackFrames[
        execState.stackFrames.length - 1
      ];

    const newLastFrame = {
      ...lastFrame,
      blockStack: lastFrame.blockStack.slice(0, -1),
    };

    const newStackFrames = [
      ...execState.stackFrames.slice(0, -1),
      newLastFrame,
    ];

    execState.stackFrames = newStackFrames;
  };

  const createFrameMeta = (args?: any): FrameMeta => ({
    args,
    origins: new Map(),
    blocks: [] as string[],
    calls: [] as string[],
    returnValue: undefined,
    hasReturned: false,
  });

  const recordCallMeta = (
    args: any[],
    prevFrame: StackFrame,
    frame: StackFrame,
    currentBlock?: BlockFrame,
  ) => {
    const { flow } = execState;
    flow.frameMeta.set(frame.id, createFrameMeta(args));
    flow.frameMeta.get(prevFrame.id)?.calls.push(frame.id);
    currentBlock &&
      flow.frameMeta
        .get(currentBlock.id)
        ?.calls.push(frame.id);
    flow.allFrames.set(frame.id, frame);
  };

  const createFrame = (
    evaluation: Evaluation,
  ): StackFrame => {
    const metaFn = getMetaFunction(evaluation.e.fn)?.e;

    const id = `${execState.flow.allFrames.size}`;

    const frame = {
      ...blankFrameState(),
      fnName: evaluation.e.e
        ? formatFnName(evaluation.e.e)
        : `<fn>`,
      id,
      name: id,
      sourceId: metaFn?.range?.join(),
      node: evaluation.e,
    };

    return frame;
  };

  const recordCall = (evaluation: Evaluation) => {
    if (evaluation.e.type === 'Apply') {
      if (evaluation.phase === 'enter') {
        const frame = createFrame(evaluation);
        recordCallMeta(
          evaluation.e.args,
          currentFrame(),
          frame,
        );
        execState.stackFrames = [
          ...execState.stackFrames,
          { blockStack: [], frame },
        ];

        emitEvaluation(
          {
            ...evaluation,
            // @ts-ignore
            phase: 'enter-after',
          },
          currentFrame(),
          { previousFrame: prevFrame() },
        );
      } else {
        const frame = execState.flow.frameMeta.get(
          currentFrame().id,
        );
        if (frame) {
          frame.returnValue = evaluation.value;
          frame.hasReturned = true;
        }

        emitEvaluation(
          {
            ...evaluation,
            // @ts-ignore
            phase: 'exit-before',
          },
          currentFrame(),
          { previousFrame: prevFrame() },
        );

        execState.stackFrames = execState.stackFrames.slice(
          0,
          -1,
        );
      }
    }
  };

  const recordOrigin = (evaluation: Evaluation) => {
    const { flow } = execState;

    if (
      evaluation.phase === 'enter' &&
      evaluation.e.type === 'VariableDeclarator'
    ) {
      const frame = currentFrame();
      const block = currentBlock();
      const declaration = evaluation.e;
      if (
        declaration.id &&
        declaration.id.type === 'Identifier'
      ) {
        const name = declaration.id.name;
        flow.frameMeta
          .get(frame.id)
          ?.origins.set(name, evaluation.e);
        block &&
          flow.frameMeta
            .get(block.id)
            ?.origins.set(name, evaluation.e);
      }
    }
  };

  const interceptor = (evaluation: Evaluation) => {
    console.info(
      evaluation.e.type,
      evaluation.phase,
      evaluation,
    );

    // @ts-ignore
    if (evaluation.config.external) return;

    recordBlock(evaluation);
    recordCall(evaluation);
    recordOrigin(evaluation);

    const isInteresting = interestingTypes.includes(
      evaluation.e.type,
    );

    if (isInteresting) {
      emitEvaluation(evaluation, currentFrame(), {
        previousFrame: prevFrame(),
      });
      update();
    }
  };

  const clearState = () => {
    execState.stackFrames = [];
  };

  // exec

  const startExec = (code: string) => {
    if (execState.running) {
      return;
    }

    clearState();
    const rootFrame = programFrame();
    execState.stackFrames = [
      { frame: rootFrame, blockStack: [] },
    ];
    execState.running = true;

    const programEnv = {
      ...execState.asyncRuntime.actions,
      ...globalObjects,
    };

    const programEnvKeys = Object.keys(programEnv);
    execState.programEnvKeys = programEnvKeys;

    parseAndEvaluate(
      code,
      handleEvaluationEnd,
      exceptionHandler,
      programEnv,
      {
        handleEvaluationEnd,
        asyncRuntime: execState.asyncRuntime,
        interceptor: interceptor,
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

  const handleEvaluationEnd = () => {
    if (execState.next) {
      return;
    }

    if (execState.asyncRuntime.handleTick()) {
      update();
    }

    onPending();
  };

  const endExec = () => {
    clearState();
    execState.nextTimer &&
      clearTimeout(execState.nextTimer);

    execState.autoStepping = false;
    execState.running = false;
    execState.next = undefined;
    execState.nextTimer = undefined;

    execState.asyncRuntime.reset();

    update();
  };

  const progressExec = () => {
    if (execState.next) {
      execState.next();
    } else {
      handleEvaluationEnd();
    }
  };

  const setSpeed = (speed: number) =>
    (execState.speed = speed);

  return {
    execState,
    currentFrame,
    startExec,
    endExec,
    progressExec,
    setSpeed,
  };
}
