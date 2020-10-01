import {
  Continuation,
  ErrorContinuation,
  Environment,
  EvaluationConfig,
  Evaluation,
  Interpreter,
  ASTNode,
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
  FrameMeta,
  Origin,
} from 'modules/meta/types';
import {
  getInterpreters,
  interestingTypes,
  globalObjects,
  shouldSkipWaitOnEnterPhase,
  shouldWaitOnValuePhase,
} from 'modules/meta/config';
import { getEnvironmentForValue } from 'metaes/environment';

const programFrame = (): StackFrame => ({
  id: '-1',
  sourceId: 'Program!',
  node: {
    type: 'Program',
  },
  parentBlockId: undefined,
  parentCallId: '-2',
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
    stackFrames: [],
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
      envFrames: new Map(),
    },
  };

  const emitEvaluation = (
    evaluation: Evaluation,
    context: EvaluationContext,
  ) => {
    // @ts-ignore
    if (!evaluation.config.external) {
      try {
        onEvaluation(
          evaluation,
          currentFrame(),
          currentBlock(),
          context,
        );
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
          recordAssignment(node, r);

          const origin = getOrigin(env, node.left.name);

          context.origin = origin;
        }

        if (node.type === 'VariableDeclarator') {
          recordOrigin(node, r);
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
              emitEvaluation(resumeEvaluation, {});
              enqueue(() => {
                execState.next = undefined;
                c(value);
              });
            },
            (value: any) => {
              execState.stackFrames = frames;
              update();
              emitEvaluation(resumeEvaluation, {});
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
    const frame =
      execState.stackFrames[
        execState.stackFrames.length - 1
      ];

    return frame?.blockStack[frame.blockStack.length - 1];
  };

  const getOrigin = (
    env: Environment,
    name: string,
  ): Origin | undefined => {
    const originEnv = getEnvironmentForValue(env, name);
    if (!originEnv) return;
    const frameId = execState.flow.envFrames.get(originEnv);
    if (!frameId) return;
    const frameMeta = execState.flow.frameMeta.get(frameId);
    const block = execState.flow.allBlocks.get(frameId);
    const frame = execState.flow.allFrames.get(
      block ? block.parentCallId : frameId,
    )!;

    if (!frameMeta) return;
    const { node } = frameMeta.origins[name];
    return { block, frame, node };
  };

  const recordBlock = (evaluation: Evaluation) => {
    const evaluationType = evaluation.e.type;
    if (blockScopeTypes.includes(evaluationType)) {
      if (evaluation.phase === 'enter') {
        const stackFrame = currentFrame();
        const prevBlock = currentBlock();
        const { flow } = execState;

        const block: StackFrame = {
          id: `${stackFrame.id}-${flow.allBlocks.size}`,
          sourceId: evaluation.e.range!.join(),
          node: evaluation.e,
          parentBlockId: prevBlock?.id,
          parentCallId: stackFrame.id,
        };

        flow.frameMeta.set(
          block.id,
          createFrameMeta(evaluation.e, evaluation.env),
        );
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

  const pushBlockFrame = (block: StackFrame) => {
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

  const createFrameMeta = (
    node: ASTNode,
    env: Environment | undefined,
  ): FrameMeta => ({
    node,
    env,
    args: node.args,
    origins: {},
    allOrigins: {},
    assignments: {},
    blocks: [] as string[],
    calls: [] as string[],
    returnValue: undefined,
    hasReturned: false,
    parentBlockId: currentBlock()?.id,
    parentCallId: currentFrame().id,
  });

  const createFrame = (
    evaluation: Evaluation,
  ): StackFrame => {
    const metaFn = getMetaFunction(evaluation.e.fn)?.e;

    const id = `${execState.flow.allFrames.size}`;

    const frame = {
      id,
      name: id,
      sourceId: metaFn?.range?.join(),
      node: evaluation.e,
      parentBlockId: currentBlock()?.id,
      parentCallId: currentFrame().id,
    };

    return frame;
  };

  const recordCallMeta = (
    node: ASTNode,
    env: Environment | undefined,
    prevFrame: StackFrame,
    frame: StackFrame,
    currentBlock?: StackFrame,
  ) => {
    const { flow } = execState;
    flow.allFrames.set(frame.id, frame);
    flow.frameMeta.set(
      frame.id,
      createFrameMeta(node, env),
    );
    flow.frameMeta.get(prevFrame.id)?.calls.push(frame.id);
    currentBlock &&
      flow.frameMeta
        .get(currentBlock.id)
        ?.calls.push(frame.id);
  };

  const recordCall = (evaluation: Evaluation) => {
    if (evaluation.e.type === 'Apply') {
      if (evaluation.phase === 'enter') {
        const frame = createFrame(evaluation);
        recordCallMeta(
          evaluation.e,
          evaluation.env,
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
          { previousFrame: prevFrame() },
        );

        execState.stackFrames = execState.stackFrames.slice(
          0,
          -1,
        );
      }
    }
  };

  const recordAssignment = (node: ASTNode, value: any) => {
    const frame = currentFrame();
    const block = currentBlock();
    const assignment = node;

    const updateAssignments = (
      id: string,
      node: ASTNode,
      value: any,
    ) => {
      const { flow } = execState;

      const assignmentsMap = flow.frameMeta.get(id)
        ?.assignments;

      if (assignmentsMap) {
        const nextVal = [
          ...(assignmentsMap[node.range!.join()] ?? []),
          {
            node,
            value,
          },
        ];

        assignmentsMap[node.range!.join()] = nextVal;
      }
    };

    if (
      assignment.left &&
      assignment.left.type === 'Identifier'
    ) {
      updateAssignments(frame.id, assignment, value);
      if (block) {
        updateAssignments(block.id, assignment, value);
      }
    }
  };

  const recordOrigin = (
    declaration: ASTNode,
    value: any,
  ) => {
    const { flow } = execState;
    const block = currentBlock();
    const frame = currentFrame();
    if (
      declaration.id &&
      declaration.id.type === 'Identifier'
    ) {
      const name = declaration.id.name;
      const frameMeta = flow.frameMeta.get(frame.id);
      if (frameMeta) {
        if (!block) {
          frameMeta.origins[name] = {
            node: declaration,
            value,
          };
        }

        frameMeta.allOrigins[name] = {
          node: declaration,
          value,
        };
      }

      if (block) {
        const blockOrigins = flow.frameMeta.get(block.id)
          ?.origins;

        if (blockOrigins) {
          blockOrigins[name] = {
            node: declaration,
            value,
          };
        }
      }
    }
  };

  const interceptor = (evaluation: Evaluation) => {
    // @ts-ignore
    if (evaluation.config.external) return;

    recordBlock(evaluation);
    recordCall(evaluation);

    if (
      evaluation.env &&
      !execState.flow.envFrames.has(evaluation.env)
    ) {
      execState.flow.envFrames.set(
        evaluation.env,
        currentBlock()?.id ?? currentFrame().id,
      );
    }

    const isInteresting = interestingTypes.includes(
      evaluation.e.type,
    );

    if (isInteresting) {
      emitEvaluation(evaluation, {
        previousFrame: prevFrame(),
      });
      update();
    }
  };

  const clearState = () => {
    execState.stackFrames = [];
    execState.flow = {
      allBlocks: new Map(),
      allFrames: new Map(),
      frameMeta: new Map(),
      envFrames: new Map(),
    };
  };

  // exec

  const startExec = (code: string) => {
    if (execState.running) {
      return;
    }

    clearState();
    const rootFrame = programFrame();

    execState.flow.allFrames.set(rootFrame.id, rootFrame);
    execState.flow.frameMeta.set(rootFrame.id, {
      node: { type: 'Program' },
      env: undefined,
      args: undefined,
      origins: {},
      allOrigins: {},
      assignments: {},
      blocks: [] as string[],
      calls: [] as string[],
      returnValue: undefined,
      hasReturned: false,
      parentBlockId: undefined,
      parentCallId: '-2',
    });

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
      handleEvaluationEnd,
      programEnv,
      {
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
    update();
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
