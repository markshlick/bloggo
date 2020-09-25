import {
  Continuation,
  ErrorContinuation,
  Environment,
  EvaluationConfig,
  Evaluation,
  ASTNode,
  Interpreter,
} from 'metaes/types';
import { JavaScriptASTNode } from 'metaes/nodeTypes';
import { getMetaFunction } from 'metaes/metafunction';
import { evaluate } from 'metaes/evaluate';
import omit from 'lodash/omit';
import { parseAndEvaluate } from 'modules/meta/evaluate';
import { eventLoop } from 'modules/meta/eventLoop';
import {
  StackFrame,
  Engine,
  ExecState,
  EvaluationContext,
  Timeout,
  blockScopeTypes,
  prettyBlockScopeTypeNames,
  NodeNames,
} from 'modules/meta/types';
import {
  getInterpreters,
  interestingTypes,
  globalObjects,
  shouldSkipWaitOnEnterPhase,
  shouldWaitOnValuePhase,
} from 'modules/meta/config';

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
    // awaitCount: 0,
    autoStepping: false,
    running: false,
    next: undefined,
    nextTimer: undefined,
    programEnvKeys: [],
    callStack: [],
    allStackNodes: [],
    // TODO: move this outside of this component
    callsRootImmutableRef: [],
    asyncRuntime: eventLoop({
      runMetaFunction: (
        fn: Function,
        args: any = [],
        done?: Function,
        fail?: Function,
      ) => runMetaFunction(fn, args, done, fail),
      handleEvaluationEnd: () => handleEvaluationEnd(),
    }),
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

    execState.callStack = [...closure.stack];
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
    execState.callStack[execState.callStack.length - 1];

  const prevFrame = () =>
    execState.callStack[execState.callStack.length - 2];

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
          const awaitEvaluation: Evaluation = {
            e: node,
            // @ts-ignore
            phase: 'resume',
            value: err,
            config,
            env,
          };

          execState.asyncRuntime.handleAwait(
            node,
            currentFrame(),
            err.value,
            (value: any) => {
              emitEvaluation(
                awaitEvaluation,
                currentFrame(),
                {},
              );
              enqueue(() => {
                execState.next = undefined;
                execState.callStack = env.stack;
                c(value);
              });
            },
            (value: any) => {
              emitEvaluation(
                awaitEvaluation,
                currentFrame(),
                {},
              );
              enqueue(() => {
                execState.next = undefined;
                execState.callStack = env.stack;
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

  const interceptor = (evaluation: Evaluation) => {
    // console.log(
    //   evaluation.e.type,
    //   evaluation.phase,
    //   evaluation.e,
    //   evaluation.env,
    // );

    // @ts-ignore
    if (evaluation.config.external) return;

    const frame = currentFrame();
    // @ts-ignore
    if (!evaluation.env.stack) {
      // @ts-ignore
      evaluation.env.stack = [...execState.callStack];
    }
    // @ts-ignore
    if (!evaluation.env.blockStack) {
      // @ts-ignore
      evaluation.env.blockStack ??= [...frame.blockStack];
    }

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
      evaluation.e?.e?.id?.name ||
      (evaluation.e?.e?.callee?.object
        ? (evaluation.e?.e?.callee?.object.type === 'Super'
            ? `<super>`
            : evaluation.e?.e?.callee?.object.name) +
          '.' +
          evaluation.e?.e?.callee?.property.name
        : '') ||
      `<fn()>`;

    if (evaluation.e.type === 'Apply') {
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
        currentFrame().hasReturned = true;
        currentFrame().returnValue = evaluation.value;

        emitEvaluation(
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
        let values = {};
        let env = evaluation.env;
        // // HACK
        // // @ts-ignore
        while (
          env &&
          env.stack[env.stack.length - 1] === frame
        ) {
          values = { ...values, ...env.values };
          env = env.prev;
        }
        frame.values = values;
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
      emitEvaluation(evaluation, currentFrame(), {
        previousFrame: prevFrame(),
      });
      update();
    }
  };

  const clearState = () => {
    execState.callStack = [];
    execState.allStackNodes = [];

    // cheating a bit here to optimize react-d3-tree rendering
    // callsRootImmutableRef is an immutable *reference*
    // BUT it's values mutate
    // NOTE - it will not be reassigned if stack frame variable change
    execState.callsRootImmutableRef = [];
  };

  // exec

  const startExec = (code: string) => {
    if (execState.running) {
      return;
    }

    clearState();
    const rootFrame = programFrame();
    execState.callStack = [rootFrame];
    execState.callsRootImmutableRef = [rootFrame];

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
