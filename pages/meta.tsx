import { useRef, useState } from 'react';

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
import { callcc } from 'metaes/callcc';

import dynamic from 'next/dynamic';
import { TextMarker, Editor } from 'codemirror';
import {
  isFunction,
  isObject,
  isString,
  isDate,
} from 'util';
import { SetValue } from 'metaes/environment';

const CodeEditor = dynamic(
  import('components/CodeEditor'),
  {
    ssr: false,
  },
);

const Tree = dynamic(import('react-d3-tree'), {
  ssr: false,
});

function formatValue(arg: any) {
  if (isFunction(arg)) {
    return `fn()`;
  } else if (isObject(arg)) {
    return `${
      arg.constructor.name === 'Object'
        ? ''
        : arg.constructor.name
    }{${Object.keys(arg).join(', ')}}`;
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

const code = `// psst: you can edit me!
function fibonacci(num) {
  if (num < 0) return null;
  if (num <= 1) return num;

  const f1 = fibonacci(num - 1);
  const f2 = fibonacci(num - 2);
  const result = f1 + f2;

  return result;
}

fibonacci(4);
`;

const globalObjs = {
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
  const [, forceUpdate] = useState();
  const update = () => forceUpdate({});
  const [stackState, setStackState] = useState<{
    currentEvaluation?: Evaluation;
    callsRoot: StackFrame[];
    stack: StackFrame[];
    allNodes: StackFrame[];
    watchValues: WatchValues;
  }>({
    stack: [],
    callsRoot: [],
    allNodes: [],
    watchValues: {},
  });

  const editorRef = useRef<Editor>();

  const execStateRef = useRef<{
    autoStepping: boolean;
    running: boolean;
    speed: number;
    marker?: TextMarker;
    nextTimer?: NodeJS.Timeout;
    next?: () => any;
    programTimers: Set<NodeJS.Timeout>;
  }>({
    autoStepping: false,
    running: false,
    speed: 400,
    marker: undefined,
    next: undefined,
    nextTimer: undefined,
    programTimers: new Set(),
  });

  const prepareMetaFunctions = () => {
    let _setTimeoutForMain;

    function _setTimeout(
      [cb, ms]: [() => void, number],
      c: (a: any) => void,
      cerr: (a: any) => void,
    ) {
      const timer = setTimeout(() => {
        execStateRef.current.programTimers.delete(timer);
        try {
          c(cb());
        } catch (error) {
          cerr(error);
        }
      }, ms);

      execStateRef.current.programTimers.add(timer);
    }

    metaesEval(
      `({ setTimeout: (cb, ms) => callcc(_setTimeout, [cb, ms]) })`,
      ({ setTimeout }) => {
        _setTimeoutForMain = setTimeout;
      },
      console.error,
      {
        callcc,
        _setTimeout,
      },
    );

    return { setTimeout: _setTimeoutForMain };
  };

  const markEditor = (e: Evaluation) => {
    if (!e.e.loc) return;

    const start = {
      ch: e.e.loc.start.column,
      line: e.e.loc.start.line - 1,
    };

    const end = {
      ch: e.e.loc.end.column,
      line: e.e.loc.end.line - 1,
    };

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

  const endExec = () => {
    if (execStateRef.current.programTimers.size) {
      return;
    }

    execStateRef.current.autoStepping = false;
    execStateRef.current.running = false;
    execStateRef.current.next = undefined;
    execStateRef.current.marker?.clear();
    execStateRef.current.nextTimer &&
      clearTimeout(execStateRef.current.nextTimer);

    update();
  };

  const startExec = () => {
    if (
      !editorRef.current ||
      execStateRef.current.running
    ) {
      return;
    }

    execStateRef.current.running = true;

    const code = editorRef.current.getDoc().getValue();

    let callsRoot: StackFrame[] = [];
    let allStackNodes: StackFrame[] = [];
    let callStack: StackFrame[] = [];

    let watchValues: WatchValues = {};

    setStackState({
      stack: [],
      callsRoot: [],
      allNodes: [],
      watchValues,
    });

    const updateStackState = (e: Evaluation) => {
      const fnName = e.e?.e?.callee.name;
      if (fnName && e.e.type === 'Apply') {
        if (e.phase === 'enter') {
          const id = `${allStackNodes.length}`;
          const frame: StackFrame = {
            fnName,
            args: e.e.args,
            id,
            name: id,
            children: [],
            values: {},
            hasReturned: false,
            returnValue: undefined,
          };

          (callStack.length
            ? callStack[callStack.length - 1].children
            : callsRoot
          ).push(frame);

          callStack.push(frame);
          allStackNodes.push(frame);
        } else {
          if (callStack.length) {
            callStack[
              callStack.length - 1
            ].hasReturned = true;

            callStack[callStack.length - 1].returnValue =
              e.value;
          }

          callStack.pop();
        }
      } else {
        if (callStack.length) {
          callStack[callStack.length - 1].values =
            e.env?.values ?? {};
        }
      }

      setStackState({
        currentEvaluation: e,
        callsRoot,
        allNodes: allStackNodes,
        stack: callStack,
        watchValues,
      });
    };

    const makeNodeHandlers = (names: NodeNames[]) => {
      const map: Partial<{ [name in NodeNames]: any }> = {};

      for (const name of names) {
        map[name] = (
          e: JavaScriptASTNode,
          c: Continuation,
          cerr: ErrorContinuation,
          env: Environment,
          config: EvaluationConfig,
        ) => {
          const next = () => {
            const f = ECMAScriptInterpreters.values[
              name
            ] as any;

            f(e, c, cerr, env, config);
          };
          // HACK: Program statements (not interesting) are handled as BlockStatements by the interpreter
          if (e.type === 'Program') {
            next();
            return;
          }

          if (execStateRef.current.autoStepping) {
            const run = () => {
              if (execStateRef.current.autoStepping) {
                next();
              }
            };

            execStateRef.current.nextTimer = setTimeout(
              run,
              execStateRef.current.speed,
            );
          }

          execStateRef.current.next = next;
        };
      }

      return map;
    };

    metaesEval(
      code,
      endExec,
      (err) => {
        alert(JSON.stringify(err));
        endExec();
      },
      {
        // ...prepareMetaFunctions(),
        ...globalObjs,
      },
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
    if (!execStateRef.current.running) {
      startExec();
    } else if (execStateRef.current.next) {
      execStateRef.current.next();
    } else {
      endExec();
    }
    update();
  };

  const handleAutoStep = () => {
    execStateRef.current.autoStepping = true;
    if (!execStateRef.current.running) {
      startExec();
    } else if (execStateRef.current.next) {
      execStateRef.current.next();
    }

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
    if (execStateRef.current.running) {
      endExec();
      update();
    }
  };

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
        {stackState.callsRoot.length ? (
          <Tree
            translate={{ x: 100, y: 100 }}
            zoom={0.5}
            orientation="vertical"
            transitionDuration={0}
            collapsible={false}
            data={[
              {
                id: 'Program',
                name: 'Program',
                fnName: 'Program',
                args: [],
                values: {},
                children: [...stackState.callsRoot],
              } as any,
            ]}
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

  const fibVals: number[] = [];
  for (const x of stackState.allNodes) {
    fibVals[x.args[0]] =
      fibVals[x.args[0]] ?? x.returnValue;
  }

  const filledArr = Array(fibVals.length).fill(null);

  const valueTable = (
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
                Index
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
                Fibonacci
              </th>
              {filledArr.map((n, i) => (
                <td key={i} style={{ padding: 4 }}>
                  {fibVals[i]}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

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

  return (
    <div style={{ margin: '0 auto', maxWidth: 840 }}>
      <h1>Ch 1: The Fibonacci Sequence</h1>
      <div key="editor" className="space">
        <div
          style={{ height: '30vh', minHeight: 320 }}
          className="space-small"
        >
          <CodeEditor
            editorDidMount={(editor) =>
              (editorRef.current = editor)
            }
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
      <div>{valueTable}</div>
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
        {callGraphEl}
      </div>
    </div>
  );
}

// @ts-ignore
Meta.layout = null;
