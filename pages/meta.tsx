import { useRef, useState, ReactElement } from 'react';
import { render } from 'react-dom';

import { Evaluation, ASTNode } from 'metaes/types';
import { getMetaFunction } from 'metaes/metafunction';

import dynamic from 'next/dynamic';
import { TextMarker, Editor, Position } from 'codemirror';

import isFunction from 'lodash/isFunction';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import isDate from 'lodash/isDate';
import isArray from 'lodash/isArray';
import {
  meta,
  StackFrame,
  WatchValues,
  interestingTypes,
} from 'helpers/meta';

const CodeEditor = dynamic(
  import('components/CodeEditor'),
  {
    ssr: false,
  },
);

const Tree = dynamic(import('react-d3-tree'), {
  ssr: false,
});

const handleError = (err: any) => {
  alert(JSON.stringify(err));
  console.error(err);
};

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

function addWidget(
  cm: Editor,
  p: Position,
  el: ReactElement,
) {
  const pos = cm.charCoords(p, 'local');

  const top = pos.top;
  const right = pos.right;
  const node = document.createElement('div');

  render(el, node);

  node.style.position = 'absolute';
  node.setAttribute('cm-ignore-events', 'true');
  node.style.top = top + 'px';
  node.style.left = right + 'px';
  // @ts-ignore
  cm.display.input.setUneditable(node);
  // @ts-ignore
  cm.display.sizer.appendChild(node);

  return node;
}

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

function x(n) {
  let s = 0;
  for (let i = 0; i <= 3; i++) {
    s = i;
  }
  
  let a;
  a = 1;

  const b = y(2);

  return a + b + y(3) + n;
}

const r = y(4);
`;

const EditorValue = ({ value }: { value: string }) => (
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

const defaultSpeed = 600;
const maxSpeed = 2000;
const minSpeed = 60;

function useEditorState() {
  const editorRef = useRef<Editor>();

  const editorItemsRef = useRef<{
    marker?: TextMarker;
    editorWidgetsByNode: Map<
      string,
      Map<string, HTMLElement>
    >;
  }>({
    marker: undefined,
    editorWidgetsByNode: new Map(),
  });

  const configEditor = (editor: Editor) => {
    editor.on('change', () => {
      clearEditor();
    });
    editorRef.current = editor;
  };

  const markEditor = (evaluation: Evaluation) => {
    editorItemsRef.current.marker?.clear();

    const editor = editorRef.current;
    const loc = astToCmLoc(evaluation.e);
    if (!loc || !editor) return;

    const editorScrollInfo = editor.getScrollInfo();
    const { top } = editor.charCoords(loc.start, 'local');

    editorItemsRef.current.marker = editor.markText(
      loc.start,
      loc.end,
      {
        css: 'background-color: rgba(230, 10, 100, 0.5);',
      },
    );

    if (
      editorScrollInfo.top > top ||
      top >
        editorScrollInfo.top + editorScrollInfo.clientHeight
    ) {
      editor.scrollTo(null, top);
    }
  };

  const getFrameWidgets = (frame: StackFrame) => {
    let frameWidgets = editorItemsRef.current.editorWidgetsByNode.get(
      frame.sourceId,
    );

    if (!frameWidgets) {
      frameWidgets = new Map();
      editorItemsRef.current.editorWidgetsByNode.set(
        frame.sourceId,
        frameWidgets,
      );
    }

    return frameWidgets;
  };

  const displayValueInEditor = (
    node: ASTNode,
    frame: StackFrame,
    value: any,
  ) => {
    if (!editorRef.current) return;

    const loc = astToCmLoc(node);
    if (!loc) return;

    const key = (node.range ?? []).join();

    const { line } = loc.start;
    const ch =
      editorRef.current?.lineInfo(line)?.text?.length ?? 0;

    // @ts-ignore
    const el = addWidget(
      editorRef.current,
      { line: line, ch: ch },
      <EditorValue value={value} />,
    );

    const frameWidgets = getFrameWidgets(frame);
    frameWidgets.get(key)?.remove();
    frameWidgets.set(key, el);

    return el;
  };

  const displayEvaluation = (
    evaluation: Evaluation,
    frame: StackFrame,
  ) => {
    if (interestingTypes.includes(evaluation.e.type)) {
      markEditor(evaluation);
    }

    if (
      evaluation.phase === 'exit' &&
      evaluation.e.type === 'AssignmentExpression'
    ) {
      displayValueInEditor(
        evaluation.e,
        frame,
        `= ${evaluation.value}`,
      );
    }

    if (
      evaluation.phase === 'exit' &&
      evaluation.e.type === 'VariableDeclarator'
    ) {
      displayValueInEditor(
        evaluation.e.id,
        frame,
        `= ${evaluation.value}`,
      );
    }

    if (
      evaluation.phase === 'exit' &&
      evaluation.e.type === 'ReturnStatement'
    ) {
      displayValueInEditor(
        evaluation.e,
        frame,
        `⇐ ${evaluation.value.value}`,
      );
    }

    if (
      evaluation.phase === 'enter' &&
      evaluation.e.type === 'Program'
    ) {
      editorItemsRef.current.editorWidgetsByNode.set(
        frame.sourceId,
        new Map(),
      );
    }
  };

  const displayApplyEnter = (
    evaluation: Evaluation,
    frame: StackFrame,
  ) => {
    const metaFn = getMetaFunction(evaluation.e.fn)?.e;
    if (!metaFn) return;

    const nodes = editorItemsRef.current.editorWidgetsByNode.get(
      frame.sourceId,
    );

    nodes?.forEach((node) => node.remove());

    editorItemsRef.current.editorWidgetsByNode.set(
      frame.sourceId,
      new Map(),
    );

    displayValueInEditor(
      metaFn,
      frame,
      `( ${evaluation.e.args.join(', ')} )`,
    );
  };

  const displayApplyExit = (
    evaluation: Evaluation,
    frame: StackFrame,
  ) => {
    const metaFn = getMetaFunction(evaluation.e.fn)?.e;
    if (!metaFn) return;

    frame.hasReturned = true;
    frame.returnValue = evaluation.value;

    displayValueInEditor(
      metaFn,
      frame,
      `( ${evaluation.e.args.join(', ')} ) => ${
        frame.returnValue
      }`,
    );
  };

  const clearCurrentMarker = () =>
    editorItemsRef.current.marker?.clear();

  const clearEditor = () => {
    clearCurrentMarker();
    editorItemsRef.current.editorWidgetsByNode.forEach(
      (l) => l.forEach((n) => n.remove()),
    );

    editorItemsRef.current.editorWidgetsByNode = new Map();
  };

  const getCode = () =>
    editorRef.current?.getDoc().getValue();

  return {
    getCode,
    clearEditor,
    clearCurrentMarker,
    displayApplyEnter,
    displayApplyExit,
    displayEvaluation,
    configEditor,
  };
}

export default function Meta() {
  const [, forceUpdate] = useState({});
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

  const {
    getCode,
    clearEditor,
    clearCurrentMarker,
    displayApplyEnter,
    displayApplyExit,
    displayEvaluation,
    configEditor,
  } = useEditorState();

  // editor ui

  const clearState = () => {
    clearEditor();
    setStackState({
      watchValues: {},
      stack: [],
      allNodes: [],
      callsRootImmutableRef: [],
    });
  };

  const update = () =>
    setStackState({
      callsRootImmutableRef:
        metaRef.current.execState.callsRootImmutableRef,
      allNodes: metaRef.current.execState.allStackNodes,
      stack: metaRef.current.execState.callStack,
      watchValues: metaRef.current.execState.watchValues,
    });

  // event handlers

  const nextStep = () => {
    const state = metaRef.current.execState;
    if (!state.running) {
      const code = getCode();
      if (code) {
        clearState();
        metaRef.current.startExec(code);
      }
    } else {
      metaRef.current.progressExec();
    }
  };

  const handleStep = () => {
    nextStep();
    update();
  };

  const handleAutoStep = () => {
    metaRef.current.execState.autoStepping = true;
    nextStep();
    update();
  };

  const handleAutoStepPause = () => {
    metaRef.current.execState.autoStepping = false;
    update();
  };

  const handleRestart = () => {
    const autoStepping =
      metaRef.current.execState.autoStepping;
    metaRef.current.endExec();
    clearCurrentMarker();
    metaRef.current.execState.autoStepping = autoStepping;

    const code = getCode();
    if (code) {
      clearState();
      metaRef.current.startExec(code);
      update();
    }
  };

  const handleExit = () => {
    metaRef.current.endExec();
    clearCurrentMarker();

    update();
  };

  const metaRef = useRef(
    meta({
      speed: defaultSpeed,
      handleError,
      displayApplyEnter,
      displayApplyExit,
      displayEvaluation,
      update,
    }),
  );

  // view helpers

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
            editorDidMount={configEditor}
            value={code}
            options={{
              readOnly: metaRef.current.execState.running,
              lineNumbers: true,
            }}
          />
        </div>
        <div className="space-small">
          <button
            className="small"
            disabled={
              metaRef.current.execState.autoStepping
            }
            onClick={handleStep}
          >
            Step
          </button>
          {' | '}
          <button
            className="small"
            disabled={
              metaRef.current.execState.autoStepping
            }
            onClick={handleAutoStep}
          >
            Auto-step
          </button>{' '}
          <button
            className="small"
            disabled={
              !metaRef.current.execState.autoStepping
            }
            onClick={handleAutoStepPause}
          >
            Pause
          </button>
          {' | '}
          <button
            className="small"
            disabled={!metaRef.current.execState.running}
            onClick={handleRestart}
          >
            Restart
          </button>{' '}
          <button
            className="small"
            disabled={!metaRef.current.execState.running}
            onClick={handleExit}
          >
            Exit
          </button>
        </div>
        <div>
          <label>Playback speed</label>{' '}
          <input
            defaultValue={
              maxSpeed - metaRef.current.execState.speed
            }
            type="range"
            min="0"
            max="2000"
            onChange={(e) => {
              metaRef.current.setSpeed(
                maxSpeed +
                  minSpeed -
                  parseInt(e.target.value),
              );
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
        {callGraphEl}
      </div>
    </div>
  );
}

// @ts-ignore
Meta.layout = null;
