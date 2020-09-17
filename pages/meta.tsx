import { useRef, useState } from 'react';
import { render } from 'react-dom';

import { metaesEval } from 'metaes';
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
import { getMetaFunction } from 'metaes/metafunction';
import { evaluate } from 'metaes/evaluate';

import dynamic from 'next/dynamic';
import { TextMarker, Editor, Position } from 'codemirror';

import isFunction from 'lodash/isFunction';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import isDate from 'lodash/isDate';
import isArray from 'lodash/isArray';
import omit from 'lodash/omit';

function addWidget(
  cm: Editor,
  p: Position,
  node: HTMLElement,
) {
  const pos = cm.charCoords(p, 'local');

  const top = pos.top;
  const right = pos.right;
  node.style.position = 'absolute';
  node.setAttribute('cm-ignore-events', 'true');
  node.style.top = top + 'px';
  node.style.left = right + 'px';
  // @ts-ignore
  cm.display.input.setUneditable(node);
  // @ts-ignore
  cm.display.sizer.appendChild(node);
}

const CodeEditor = dynamic(
  import('components/CodeEditor'),
  {
    ssr: false,
  },
);

const Tree = dynamic(import('react-d3-tree'), {
  ssr: false,
});

type Timeout = (fn: () => void, ms: number) => number;

function formatValue(arg: any): string {
  if (isFunction(arg)) {
    return `fn()`;
  } else if (isArray(arg)) {
    return isArray(arg[0])
      ? `[...]`
      : `[${formatValue(arg[0])}${
          arg.length > 1 ? ', ...' : ''
        }]`;
  } else if (isObject(arg)) {
    const keys = Object.keys(arg);
    return `${
      arg.constructor.name === 'Object'
        ? ''
        : arg.constructor.name
    }{${keys.join(', ')}}`;
  } else if (isDate(arg)) {
    return `Date{${arg.toISOString()}}`;
  } else if (isString(arg)) {
    return `"${arg}"`;
  } else {
    return arg;
  }
}

function formatArgs(args: any[]) {
  return args.map((arg) => formatValue(arg)).join(', ');
}

// const code = `// psst: you can edit me!
// function fibonacci(num) {
//   if (num < 0) return null;
//   if (num <= 1) return num;

//   const f1 = fibonacci(num - 1);
//   const f2 = fibonacci(num - 2);
//   const result = f1 + f2;

//   return result;
// }

// fibonacci(4);
// `;

const code = `// psst: you can edit me!
function y(a) {
  return a;
}

function x(num) {
  let s = 0;
  for (let i = 0; i <= 3; i++) {
    s = i;
  }
  
  let a;
  a = 1;

  const b = y(2);

  return a + b + y(3);
}

const r = x(4);
`;

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

const interestingTypes: NodeNames[] = [
  'BlockStatement',
  'ReturnStatement',
  'AssignmentPattern',
  'AssignmentExpression',
  'VariableDeclaration',
  'CallExpression',
  'ExpressionStatement',
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'ConditionalExpression',
];

type StackFrame = {
  id: string;
  name: string;
  fnName: string;
  args: any[];
  values: {
    [key: string]: any;
  };
  returnValue: any;
  children: StackFrame[];
  hasReturned: boolean;
  sourceId: string;
};

type WatchValues = Record<
  string,
  { frame: StackFrame; value: any }[]
>;

const GraphNode = ({
  nodeData,
}: {
  nodeData?: StackFrame;
}) => {
  return (
    <div>
      {nodeData ? (
        <strong>
          {nodeData?.fnName}(
          {nodeData ? formatArgs(nodeData?.args) : ''})
          {/* {' => '}
        {nodeData?.hasReturned
          ? nodeData?.returnValue
          : '...'} */}
        </strong>
      ) : null}
    </div>
  );
};

export default function Meta() {
  const [, forceUpdate] = useState({});
  const update = () => forceUpdate({});
  const [stackState, setStackState] = useState<{
    currentEvaluation?: Evaluation;
    callsRootImmutableRef: StackFrame[];
    stack: StackFrame[];
    allNodes: StackFrame[];
    watchValues: WatchValues;
  }>({
    stack: [],
    callsRootImmutableRef: [],
    allNodes: [],
    watchValues: {},
  });

  const editorRef = useRef<Editor>();

  const execStateRef = useRef<{
    autoStepping: boolean;
    running: boolean;
    speed: number;
    marker?: TextMarker;
    nextTimer?: number;
    next?: () => any;
    programTimers: Set<number>;
    programIntervals: Set<number>;
    editorWidgetsByNode: Map<
      string,
      Map<string, HTMLElement>
    >;
  }>({
    autoStepping: false,
    running: false,
    speed: 400,
    marker: undefined,
    next: undefined,
    nextTimer: undefined,
    programTimers: new Set(),
    programIntervals: new Set(),
    editorWidgetsByNode: new Map(),
  });

  const markEditor = (evaluation: Evaluation) => {
    const loc = astToCmLoc(evaluation.e);
    if (!loc) return;

    const { start, end } = loc;

    execStateRef.current.marker?.clear();

    editorRef.current?.setCursor(start, 20);

    execStateRef.current.marker = editorRef.current?.markText(
      start,
      end,
      {
        css: 'background-color: rgba(230, 10, 100, 0.5);',
      },
    );
  };

  const maybeEndExec = () => {
    if (
      !execStateRef.current.programTimers.size &&
      !execStateRef.current.programIntervals.size &&
      !execStateRef.current.next
    ) {
      endExec();
    }
  };

  const endExec = () => {
    execStateRef.current.nextTimer &&
      clearTimeout(execStateRef.current.nextTimer);

    execStateRef.current.programTimers.forEach((t) =>
      clearTimeout(t),
    );

    execStateRef.current.programIntervals.forEach((t) =>
      clearInterval(t as any),
    );

    execStateRef.current.marker?.clear();

    execStateRef.current.autoStepping = false;
    execStateRef.current.running = false;
    execStateRef.current.next = undefined;

    update();
  };

  const progressExec = () => {
    if (!execStateRef.current.running) {
      startExec();
    } else if (execStateRef.current.next) {
      execStateRef.current.next();
    } else {
      maybeEndExec();
    }
  };

  const clear = () => {
    execStateRef.current.editorWidgetsByNode.forEach((l) =>
      l.forEach((n) => n.remove()),
    );

    execStateRef.current.editorWidgetsByNode = new Map();

    setStackState({
      watchValues: {},
      stack: [],
      allNodes: [],
      callsRootImmutableRef: [],
    });
  };

  const startExec = () => {
    if (
      !editorRef.current ||
      execStateRef.current.running
    ) {
      return;
    }

    clear();

    let allStackNodes: StackFrame[] = [];
    let callStack: StackFrame[] = [
      {
        fnName: 'Program',
        id: '-1',
        name: '-1',
        args: [],
        children: [],
        values: {},
        hasReturned: false,
        returnValue: undefined,
        sourceId: 'Program!',
      },
    ];
    let watchValues: WatchValues = {};

    // cheating a bit here to optimize react-d3-tree rendering
    // callsRootImmutableRef is an immutable *reference*
    // BUT it's values mutate
    // NOTE - it will not be reassigned if stack frame variable change
    let callsRootImmutableRef: StackFrame[] = [];

    execStateRef.current.running = true;

    const code = editorRef.current.getDoc().getValue();

    const prepareHooks = () => {
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

      return {
        clearTimeout: (timer: number) => {
          execStateRef.current.programTimers.delete(timer);
          clearTimeout(timer);
        },
        clearInterval: (timer: number) => {
          execStateRef.current.programIntervals.delete(
            timer,
          );
          clearInterval(timer);
        },
        setTimeout: function (fn: () => void, ms: number) {
          const timer = (setTimeout as Timeout)(() => {
            execStateRef.current.programTimers.delete(
              timer,
            );

            runMetaFunction(fn);
          }, ms);

          execStateRef.current.programTimers.add(timer);

          return timer;
        },
        setInterval: function (fn: () => void, ms: number) {
          const timer = (setInterval as Timeout)(() => {
            runMetaFunction(fn);
          }, ms);

          execStateRef.current.programIntervals.add(timer);

          return timer;
        },
      };
    };

    // const prepareHooks = () => {
    //   return liftedAll({
    //   });
    // };

    const Val = ({ value }: { value: string }) => (
      <div
        style={{
          marginLeft: 8,
          fontStyle: 'italic',
          borderRadius: '4px',
          color: 'pink',
        }}
      >
        {value}
      </div>
    );

    const addValueToEditor = (
      node: ASTNode,
      value: any,
    ) => {
      if (!callStack.length || !editorRef.current) return;

      const loc = astToCmLoc(node);
      if (!loc) return;

      const frame = callStack[callStack.length - 1];
      const key = (node.range ?? []).join();

      const { line } = loc.start;
      const ch =
        editorRef.current?.lineInfo(line)?.text?.length ??
        0;

      const el = document.createElement('div');
      render(<Val value={value} />, el);

      // @ts-ignore
      addWidget(
        editorRef.current,
        { line: line, ch: ch },
        el,
      );

      execStateRef.current.editorWidgetsByNode
        .get(frame.sourceId)
        ?.get(key)
        ?.remove();

      execStateRef.current.editorWidgetsByNode
        .get(frame.sourceId)
        ?.set(key, el);

      return el;
    };

    const updateStackState = (evaluation: Evaluation) => {
      const fnName =
        evaluation.e?.e?.callee?.name ||
        evaluation.e?.e?.id?.name;

      if (
        evaluation.phase === 'exit' &&
        evaluation.e.type === 'AssignmentExpression'
      ) {
        addValueToEditor(
          evaluation.e,
          `= ${evaluation.value}`,
        );
      }

      if (
        evaluation.phase === 'exit' &&
        evaluation.e.type === 'VariableDeclarator'
      ) {
        addValueToEditor(
          evaluation.e.id,
          `= ${evaluation.value}`,
        );
      }

      if (
        evaluation.phase === 'exit' &&
        evaluation.e.type === 'ReturnStatement'
      ) {
        addValueToEditor(
          evaluation.e,
          `⇐ ${evaluation.value.value}`,
        );
      }

      if (fnName && evaluation.e.type === 'Apply') {
        const metaFn = getMetaFunction(evaluation.e.fn).e;
        if (evaluation.phase === 'enter') {
          const id = `${allStackNodes.length}`;
          const frame: StackFrame = {
            fnName,
            id,
            name: id,
            args: evaluation.e.args,
            children: [],
            values: {},
            hasReturned: false,
            returnValue: undefined,
            sourceId: metaFn.range.join(),
          };

          (callStack.length
            ? callStack[callStack.length - 1].children
            : callsRootImmutableRef
          ).push(frame);

          callStack.push(frame);
          allStackNodes.push(frame);
          callsRootImmutableRef = [
            ...callsRootImmutableRef,
          ];

          const nodes = execStateRef.current.editorWidgetsByNode.get(
            frame.sourceId,
          );

          nodes?.forEach((node) => node.remove());

          execStateRef.current.editorWidgetsByNode.set(
            frame.sourceId,
            new Map(),
          );

          addValueToEditor(
            metaFn,
            `( ${evaluation.e.args.join(', ')} )`,
          );
        } else {
          if (callStack.length) {
            const frame = callStack[callStack.length - 1];

            frame.hasReturned = true;
            frame.returnValue = evaluation.value;

            addValueToEditor(
              metaFn,
              `( ${evaluation.e.args.join(', ')} ) => ${
                frame.returnValue
              }`,
            );
          }

          callStack.pop();
          callsRootImmutableRef = [
            ...callsRootImmutableRef,
          ];
        }
      } else {
        const frame = callStack[callStack.length - 1];
        if (frame.id === '-1') {
          const values = omit(
            evaluation.env?.values ?? {},
            programEnvKeys,
          );

          frame.values = values;
        } else {
          frame.values = evaluation.env?.values ?? {};
        }
      }

      setStackState({
        callsRootImmutableRef,
        allNodes: allStackNodes,
        stack: callStack,
        watchValues,
      });
    };

    const handleError = (err: any) => {
      alert(JSON.stringify(err));
      console.error(err);
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
            execStateRef.current.next = undefined;
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

          if (execStateRef.current.autoStepping) {
            const run = () => {
              if (execStateRef.current.autoStepping) {
                setTimeout(next, 10);
              }
            };

            execStateRef.current.nextTimer = (setTimeout as Timeout)(
              run,
              execStateRef.current.speed,
            );
          }

          execStateRef.current.next = next;
        };
      }

      return map;
    };

    const programEnv = {
      ...prepareHooks(),
      ...globalObjects,
    };

    const programEnvKeys = Object.keys(programEnv);

    metaesEval(
      code,
      maybeEndExec,
      handleError,
      programEnv,
      {
        interpreters: {
          prev: ECMAScriptInterpreters,
          values: {
            ...makeNodeHandlers(interestingTypes),
            SetValue(
              e: {
                name: string;
                value: any;
                isDeclaration: boolean;
              },
              c: Continuation,
              cerr: ErrorContinuation,
              env: Environment,
            ) {
              const frame = callStack[callStack.length - 1];
              const k = `${frame?.fnName ?? ''}:${e.name}`;
              watchValues[k] = watchValues[k] ?? [];
              watchValues[k].push({
                frame,
                value: e.value,
              });

              SetValue(e, c, cerr, env);
            },
          },
        },
        interceptor(e) {
          updateStackState(e);

          if (interestingTypes.includes(e.e.type)) {
            markEditor(e);
          }
        },
      },
    );
  };

  const handleStep = () => {
    progressExec();
    update();
  };

  const handleAutoStep = () => {
    execStateRef.current.autoStepping = true;
    progressExec();
    update();
  };

  const handleAutoStepPause = () => {
    execStateRef.current.autoStepping = false;
    update();
  };

  const handleRestart = () => {
    const autoStepping = execStateRef.current.autoStepping;
    endExec();
    execStateRef.current.autoStepping = autoStepping;
    startExec();
    update();
  };

  const handleExit = () => {
    endExec();
    update();
  };

  function valueTable() {
    const indexerName = 'Input';
    const valueName = 'Fibonacci';

    const tableValues: number[] = [];
    for (const x of stackState.allNodes) {
      tableValues[x.args[0]] =
        tableValues[x.args[0]] ?? x.returnValue;
    }

    const filledArr = Array(tableValues.length).fill(null);

    return (
      <div key="table" className="space">
        <h2>Values</h2>
        <div
          style={{
            overflow: 'scroll',
            border: '1px lightgray solid',
            borderRadius: 4,
            padding: 12,
          }}
        >
          <table>
            <tbody>
              <tr>
                <th
                  scope="row"
                  align="left"
                  style={{ padding: 4 }}
                >
                  {indexerName}
                </th>
                {filledArr.map((n, i) => (
                  <td key={i} style={{ padding: 4 }}>
                    {i}
                  </td>
                ))}
              </tr>
              <tr>
                <th
                  scope="row"
                  align="left"
                  style={{ padding: 4 }}
                >
                  {valueName}
                </th>
                {filledArr.map((n, i) => (
                  <td key={i} style={{ padding: 4 }}>
                    {tableValues[i]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const callStackEl = (
    <div key="stack">
      <h2>The Stack</h2>
      <div
        style={{
          height: '300px',
          overflow: 'scroll',
          border: '1px lightgray solid',
          borderRadius: 4,
          padding: 12,
        }}
      >
        {[...stackState.stack]
          .reverse()
          .map(
            (
              {
                id,
                fnName,
                args,
                values,
                returnValue,
                hasReturned,
              },
              i,
            ) => {
              const {
                this: _1,
                arguments: _2,
                ...restValues
              } = values;
              return (
                <div
                  key={id}
                  className="space-small"
                  style={{
                    border: '1px lightgray solid',
                    borderRadius: 4,
                    padding: 12,
                  }}
                >
                  <h4 className="no-space">
                    [{stackState.stack.length - i}]{' '}
                    <em>
                      {fnName}({formatArgs(args)})
                    </em>
                  </h4>
                  <div style={{ marginLeft: 12 }}>
                    {Object.entries(restValues).map(
                      ([name, value]) => (
                        <div key={name}>
                          <small>
                            <strong>{name} = </strong>
                            <em>{formatValue(value)}</em>
                          </small>
                        </div>
                      ),
                    )}
                    {hasReturned && (
                      <div key="return">
                        <small>
                          <strong>{'<='} </strong>
                          <em>
                            {formatValue(returnValue)}
                          </em>
                        </small>
                      </div>
                    )}
                  </div>
                </div>
              );
            },
          )}
      </div>
    </div>
  );

  const callGraphEl = (
    <div key="graph">
      <h2>The Call Graph</h2>
      <div
        style={{
          height: '300px',
          border: '1px lightgray solid',
          borderRadius: 4,
        }}
      >
        {stackState.callsRootImmutableRef.length ? (
          <Tree
            translate={{ x: 100, y: 100 }}
            zoom={0.5}
            orientation="vertical"
            transitionDuration={0}
            collapsible={false}
            data={stackState.callsRootImmutableRef}
            allowForeignObjects
            nodeLabelComponent={{
              foreignObjectWrapper: {
                y: 24,
              },
              render: <GraphNode />,
            }}
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <div style={{ margin: '0 auto', maxWidth: 840 }}>
      <h1>Ch 1: The Fibonacci Sequence</h1>
      <div key="editor" className="space">
        <div
          style={{ height: '30vh', minHeight: 320 }}
          className="space-small"
        >
          <CodeEditor
            editorDidMount={(editor) => {
              return (editorRef.current = editor);
            }}
            value={code}
            options={{
              readOnly: execStateRef.current.running,
              lineNumbers: true,
            }}
          />
        </div>
        <div className="space-small">
          <button
            className="small"
            disabled={execStateRef.current.autoStepping}
            onClick={handleStep}
          >
            Step
          </button>
          {' | '}
          <button
            className="small"
            disabled={execStateRef.current.autoStepping}
            onClick={handleAutoStep}
          >
            Auto-step
          </button>{' '}
          <button
            className="small"
            disabled={!execStateRef.current.autoStepping}
            onClick={handleAutoStepPause}
          >
            Pause
          </button>
          {' | '}
          <button
            className="small"
            disabled={!execStateRef.current.running}
            onClick={handleRestart}
          >
            Restart
          </button>{' '}
          <button
            className="small"
            disabled={!execStateRef.current.running}
            onClick={handleExit}
          >
            Exit
          </button>
        </div>
        <div>
          <label>Playback speed</label>{' '}
          <input
            defaultValue={2000 - execStateRef.current.speed}
            type="range"
            min="0"
            max="2000"
            onChange={(e) => {
              execStateRef.current.speed =
                2100 - parseInt(e.target.value);
            }}
          />
        </div>
      </div>
      {/* <div>{valueTable()}</div> */}
      <div
        key="data"
        className="space"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridGap: '20px',
        }}
      >
        {callStackEl}
        {/* {callGraphEl} */}
      </div>
    </div>
  );
}

// @ts-ignore
Meta.layout = null;

function astToCmLoc(e: ASTNode) {
  if (!e.loc) return;

  const start = {
    ch: e.loc.start.column,
    line: e.loc.start.line - 1,
  };

  const end = {
    ch: e.loc.end.column,
    line: e.loc.end.line - 1,
  };
  return { start, end };
}
