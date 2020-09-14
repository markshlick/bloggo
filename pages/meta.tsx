import {
  Continuation,
  ErrorContinuation,
  Environment,
  EvaluationConfig,
  Evaluation,
} from 'metaes/types';

import dynamic from 'next/dynamic';

import { TextMarker, Editor } from 'codemirror';
import { ECMAScriptInterpreters } from 'metaes/interpreters';

import { useRef, useState } from 'react';
import { metaesEval } from 'metaes';

const CodeEditor = dynamic(import('components/Editor'), {
  ssr: false,
});

const Tree = dynamic(import('react-d3-tree'), {
  ssr: false,
});

const timeout = 100;

const code = `function fibonacci(num) {
  if (num <= 1) return 1;

  const f1 = fibonacci(num - 1);
  const f2 = fibonacci(num - 2);
  const r = f1 + f2;

  return r;
}

fibonacci(4);
`;

type NodeNames = keyof typeof ECMAScriptInterpreters.values;

const interestingTypes: NodeNames[] = [
  'ReturnStatement',
  'IfStatement',
  'AssignmentPattern',
  'AssignmentExpression',
  'VariableDeclaration',
  'CallExpression',
  'ExpressionStatement',
];

type StackNode = {
  id: number;
  name: string;
  // evaluation: Evaluation;
  args: any[];
  values: {
    [key: string]: any;
  };
  returnValue: any;
  children: StackNode[];
};

export default function Meta() {
  const [stackState, setStackState] = useState<{
    callsRoot: StackNode[];
    stack: StackNode[];
    allNodes: StackNode[];
  }>({ stack: [], callsRoot: [], allNodes: [] });
  const editorRef = useRef<Editor>();
  const metaRef = useRef<{ running: boolean }>({
    running: false,
  });

  const run = () => {
    const editor = editorRef.current;
    if (!editor || metaRef.current.running) {
      return;
    }
    let marker: TextMarker;
    const code = editor.getDoc().getValue();

    let callsRoot: StackNode[] = [];
    let allNodes: StackNode[] = [];
    let callStack: StackNode[] = [];

    const recordStack = (e: Evaluation) => {
      if (e.e.type === 'Apply') {
        if (e.phase === 'enter') {
          const fnName = e.e.e.callee.name;
          const r: StackNode = {
            name: `${fnName}(${e.e.args.join()})`,
            args: e.e.args,
            id: allNodes.length,
            children: [],
            values: {},
            returnValue: undefined,
          };

          (callStack.length
            ? callStack[callStack.length - 1].children
            : callsRoot
          ).push(r);
          callStack.push(r);
          allNodes.push(r);
        } else {
          if (callStack.length) {
            callStack[callStack.length - 1].name += ` => ${
              e.value || 'void'
            }`;
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
        callsRoot,
        allNodes,
        stack: callStack,
      });
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

      marker?.clear();

      marker = editor.markText(start, end, {
        css: 'background-color: rgba(230, 10, 100, 0.5);',
      });
    };

    metaRef.current.running = true;
    const done = () => {
      marker?.clear();
      setStackState({ stack: [], callsRoot, allNodes });
      metaRef.current.running = false;
    };

    const showNode = (name: NodeNames) => (
      e: unknown,
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

      setTimeout(next, timeout);
    };

    const makeNodeHandlers = (names: NodeNames[]) => {
      const map: Partial<{ [name in NodeNames]: any }> = {};

      for (const name of names) {
        map[name] = showNode(name);
      }

      return map;
    };

    metaesEval(
      code,
      done,
      done,
      {},
      {
        interpreters: {
          prev: ECMAScriptInterpreters,
          values: makeNodeHandlers(interestingTypes),
        },
        interceptor(e) {
          recordStack(e);

          if (interestingTypes.includes(e.e.type)) {
            markEditor(e);
          }
        },
      },
    );
  };

  return (
    <div
      style={{
        minHeight: 600,
        boxSizing: 'border-box',
        padding: 30,
        display: 'grid',
        gridTemplateRows: '1fr 1fr',
        gridGap: 30,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridGap: 30,
        }}
      >
        <div>
          <div className="space-small">
            <CodeEditor
              editorDidMount={(editor) =>
                (editorRef.current = editor)
              }
              value={code}
              options={{}}
            />
          </div>
          {/* <button onClick={run}>Step</button>{' '} */}
          <button onClick={run}>Run</button>{' '}
          {/* <button onClick={run}>Pause</button>{' '} */}
        </div>
        <div style={{ position: 'relative' }}>
          {stackState.stack.map(({ name, values }, i) => {
            const {
              arguments: _arguments,
              this: _this,
              ...rest
            } = values ?? {};

            const offset = stackState.stack.length - i - 1;

            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  transition: `transform ${timeout}ms`,
                  transformOrigin: 'top',
                  transform: `translateY(${i * 10}px)
                    scale(${Math.max(
                      0.2,
                      1 - offset * 0.1,
                    )})`,
                  background: `linear-gradient(
                      -45deg,
                      rgba(255,255,255,0.7),
                      rgba(230,230,240,0.7)
                    )`,
                  width: '100%',
                  height: 300,
                  padding: 30,
                  borderRadius: 8,
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0px 0px 15px #55555544',
                }}
              >
                <h3>{name}</h3>
                {Object.entries(rest).map(([key, val]) => {
                  return (
                    <div key={key}>
                      <strong>{key}:</strong>{' '}
                      {JSON.stringify(val)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div
        style={{
          height: '100%',
          width: '100%',
          border: '1px lightgray solid',
          borderRadius: 8,
        }}
      >
        {stackState.callsRoot.length ? (
          <Tree
            translate={{ x: 200, y: 60 }}
            orientation={'vertical'}
            collapsible={false}
            transitionDuration={0}
            zoom={0.6}
            separation={{ siblings: 2, nonSiblings: 2 }}
            data={[...stackState.callsRoot]}
          />
        ) : null}
      </div>
    </div>
  );
}
// @ts-ignore
Meta.layout = null;
